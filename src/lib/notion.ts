import {
  APIErrorCode,
  Client,
  ClientErrorCode,
  isNotionClientError,
} from "@notionhq/client";
import {
  NOTION_API_KEY,
  NOTION_DATABASE_ID,
  NOTION_DATA_SOURCE_ID,
  NOTION_RSVP_DATA_SOURCE_ID,
} from "astro:env/server";
import type { Seat } from "./rsvp";
import type {
  BlockObjectResponse,
  DataSourceObjectResponse,
  PageObjectResponse,
  RichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints";

const notion = new Client({
  auth: NOTION_API_KEY,
});

const DATABASE_ID = NOTION_DATABASE_ID;
const DATA_SOURCE_ID = NOTION_DATA_SOURCE_ID;
const RSVP_DATA_SOURCE_ID = NOTION_RSVP_DATA_SOURCE_ID;

type RichText = Array<RichTextItemResponse>;

interface Post {
  id: string;
  title: string;
  slug: string;
  date: string | null;
  excerpt: string | null;
  blocks: Array<Block>;
}

type Block =
  | { type: "paragraph"; text: RichText }
  | { type: "heading_2"; text: RichText }
  | { type: "heading_3"; text: RichText }
  | { type: "bulleted_list_item"; text: RichText }
  | { type: "numbered_list_item"; text: RichText }
  | {
      type: "image";
      url: string;
      caption: RichText;
      source: "external" | "file";
      expiryTime?: string;
    };

type PageProperties = PageObjectResponse["properties"];
type PageProperty = PageProperties[string];
type DataSourceProperties = DataSourceObjectResponse["properties"];

type QueryArgs = Parameters<typeof notion.dataSources.query>[0];
type PostSort = NonNullable<QueryArgs["sorts"]>[number];

function extractRichText(block: BlockObjectResponse): RichText | null {
  switch (block.type) {
    case "paragraph":
      return block.paragraph.rich_text;
    case "heading_2":
      return block.heading_2.rich_text;
    case "heading_3":
      return block.heading_3.rich_text;
    case "bulleted_list_item":
      return block.bulleted_list_item.rich_text;
    case "numbered_list_item":
      return block.numbered_list_item.rich_text;
    default:
      return null;
  }
}

function transformBlock(block: BlockObjectResponse): Block | null {
  if (block.type === "image") {
    if (block.image.type === "external") {
      return {
        type: "image",
        url: block.image.external.url,
        caption: block.image.caption,
        source: "external",
      };
    }

    return {
      type: "image",
      url: block.image.file.url,
      caption: block.image.caption,
      source: "file",
      expiryTime: block.image.file.expiry_time,
    };
  }

  const richText = extractRichText(block);
  if (!richText) return null;

  switch (block.type) {
    case "paragraph":
      return { type: "paragraph", text: richText };
    case "heading_2":
      return { type: "heading_2", text: richText };
    case "heading_3":
      return { type: "heading_3", text: richText };
    case "bulleted_list_item":
      return { type: "bulleted_list_item", text: richText };
    case "numbered_list_item":
      return { type: "numbered_list_item", text: richText };
    default:
      return null;
  }
}

async function resolveDataSourceId() {
  if (DATA_SOURCE_ID) return DATA_SOURCE_ID;

  if (!DATABASE_ID) {
    throw new Error(
      "Set NOTION_DATABASE_ID or NOTION_DATA_SOURCE_ID to fetch wedding posts.",
    );
  }

  try {
    const database = await notion.databases.retrieve({
      database_id: DATABASE_ID,
    });

    if ("data_sources" in database && database.data_sources.length > 0) {
      return database.data_sources[0].id;
    }
  } catch (error) {
    try {
      const dataSource = await notion.dataSources.retrieve({
        data_source_id: DATABASE_ID,
      });

      if ("id" in dataSource) return dataSource.id;
    } catch {
      throw error;
    }
  }

  throw new Error("No data source found for the wedding Notion database.");
}

async function getDataSource() {
  const dataSourceId = await resolveDataSourceId();
  const dataSource = await notion.dataSources.retrieve({
    data_source_id: dataSourceId,
  });

  if (!("properties" in dataSource)) {
    throw new Error("Could not retrieve wedding Notion data source schema.");
  }

  return dataSource;
}

async function getPageBlocks(pageId: string): Promise<Array<Block>> {
  const blocks: Array<Block> = [];
  let cursor: string | undefined;

  do {
    const response = await notion.blocks.children.list({
      block_id: pageId,
      start_cursor: cursor,
    });

    for (const block of response.results) {
      if ("type" in block) {
        const transformed = transformBlock(block);
        if (transformed) blocks.push(transformed);
      }
    }

    cursor = response.has_more
      ? (response.next_cursor ?? undefined)
      : undefined;
  } while (cursor);

  return blocks;
}

function findPropertyName(
  properties: DataSourceProperties,
  type: string,
  preferredNames: Array<string>,
) {
  for (const name of preferredNames) {
    if (name in properties && properties[name].type === type) return name;
  }

  const matchingProperty = Object.entries(properties).find(
    ([, property]) => property.type === type,
  );

  return matchingProperty ? matchingProperty[0] : undefined;
}

function textFromRichText(richText: RichText) {
  return richText.map((item) => item.plain_text).join("");
}

function textFromProperty(property: PageProperty | undefined) {
  if (!property) return null;

  switch (property.type) {
    case "title":
      return textFromRichText(property.title);
    case "rich_text":
      return textFromRichText(property.rich_text);
    default:
      return null;
  }
}

function dateFromProperty(property: PageProperty | undefined) {
  if (!property || property.type !== "date") return null;
  return property.date?.start ?? null;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function excerptFromBlocks(blocks: Array<Block>) {
  const paragraph = blocks.find((block) => block.type === "paragraph");
  if (!paragraph) return null;

  const text = textFromRichText(paragraph.text).trim();
  if (!text) return null;

  return text.length > 180 ? `${text.slice(0, 177).trim()}...` : text;
}

function publicationFilter(properties: DataSourceProperties) {
  if ("Published" in properties && properties.Published.type === "checkbox") {
    return {
      property: "Published",
      checkbox: {
        equals: true,
      },
    } as const;
  }

  if ("Status" in properties && properties.Status.type === "status") {
    return {
      property: "Status",
      status: {
        equals: "Published",
      },
    } as const;
  }

  return undefined;
}

function sortForPosts(properties: DataSourceProperties): Array<PostSort> {
  const dateProperty = findPropertyName(properties, "date", [
    "Date",
    "Published Date",
    "Published At",
    "Post Date",
  ]);

  if (dateProperty) {
    return [
      {
        property: dateProperty,
        direction: "descending",
      },
    ];
  }

  return [
    {
      timestamp: "last_edited_time",
      direction: "descending",
    },
  ];
}

function postFromPage(
  page: PageObjectResponse,
  properties: DataSourceProperties,
  blocks: Array<Block>,
): Post | null {
  const titleProperty = findPropertyName(properties, "title", [
    "Name",
    "Title",
  ]);
  const dateProperty = findPropertyName(properties, "date", [
    "Date",
    "Published Date",
    "Published At",
    "Post Date",
  ]);
  const excerptProperty = findPropertyName(properties, "rich_text", [
    "Excerpt",
    "Summary",
    "Description",
  ]);

  const title = textFromProperty(
    titleProperty ? page.properties[titleProperty] : undefined,
  );

  if (!title) return null;

  const slug =
    textFromProperty(page.properties.Slug) ||
    textFromProperty(page.properties.slug) ||
    slugify(title);

  return {
    id: page.id,
    title,
    slug,
    date: dateFromProperty(
      dateProperty ? page.properties[dateProperty] : undefined,
    ),
    excerpt:
      textFromProperty(
        excerptProperty ? page.properties[excerptProperty] : undefined,
      ) || excerptFromBlocks(blocks),
    blocks,
  };
}

export interface RsvpSubmission {
  email: string;
  seats: Array<Seat>;
}

/**
 * Thrown when a party was written to Notion in part. Carries enough to find
 * the wreckage without guesswork: every row that did land shares this
 * `submission` id, and `written` says how many of them to expect.
 *
 * This exists because a truncated party is otherwise invisible. The rows are
 * field-for-field identical to a genuine smaller party — nothing on a row
 * records how many people were meant to be on it — so three rows from a
 * family of six read as a family of three, forever.
 */
export class PartialRsvpError extends Error {
  readonly name = "PartialRsvpError";

  constructor(
    readonly submission: string,
    readonly written: number,
    readonly total: number,
    options?: { cause?: unknown },
  ) {
    super(
      `RSVP ${submission} was written in part: ${written} of ${total} seats reached Notion. ` +
        `The rows carrying this submission id are that partial write.`,
      options,
    );
  }
}

/**
 * How many times one seat is attempted before the party is declared partial.
 * Three covers a single transient blip without stranding the guest on a
 * spinner: with the backoff below, the worst case adds roughly three seconds.
 */
const MAX_ATTEMPTS = 3;

const RETRY_BASE_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Whether a failed write is worth repeating.
 *
 * The SDK will not do this for us. Its own `canRetry` gates retries behind
 * `method === "get" || method === "delete"`, reasoning that a repeated POST
 * might create the row twice — so a `pages.create` that meets a 500 comes
 * back unretried, and a single blip truncates the party.
 *
 * We take the opposite trade, deliberately. A duplicate row is conspicuous in
 * triage (same Submission id, same Seat ordinal) and takes one click to
 * delete; a missing row looks exactly like a smaller party and nobody ever
 * finds it. The duplicate is also only reachable when the write succeeded and
 * the *response* was lost, which is rarer than the failures listed here.
 */
const RETRYABLE_CODES: ReadonlySet<string> = new Set([
  APIErrorCode.RateLimited,
  APIErrorCode.InternalServerError,
  APIErrorCode.ServiceUnavailable,
  APIErrorCode.ServiceOverload,
  APIErrorCode.GatewayTimeout,
  APIErrorCode.ConflictError,
  ClientErrorCode.RequestTimeout,
  ClientErrorCode.ResponseError,
]);

function isRetryable(error: unknown): boolean {
  // A bare network failure never reached Notion's error format. It is also
  // the most retryable thing there is, so it is not left to the set below.
  if (!isNotionClientError(error)) return error instanceof TypeError;
  return RETRYABLE_CODES.has(error.code);
}

/**
 * Notion asks for a specific wait when it rate-limits. Honouring it is both
 * faster and politer than guessing, so the header wins where it is present.
 */
function retryDelayMs(error: unknown, attempt: number): number {
  // Typed loosely on purpose: only the rate-limited errors carry headers, and
  // the SDK's header type is not worth importing to read one field.
  const headers =
    isNotionClientError(error) && "headers" in error
      ? (error.headers as { get?(name: string): string | null } | undefined)
      : undefined;

  const retryAfter = Number(headers?.get?.("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, 5000);
  }

  // Exponential: 400ms, then 800ms.
  return RETRY_BASE_MS * 2 ** (attempt - 1);
}

/**
 * Appends one row per seat to the RSVP Submissions inbox.
 *
 * Deliberately *not* the curated Wedding Guests list: these names were typed
 * by whoever loaded the page, while a Guests row is a seat Jacob and Vicki
 * decided to offer. Rows land with Triage = New and are matched to a real
 * seat by hand through the "Matched guest" relation.
 *
 * Notion has no batch create and no transaction, so a party is written a seat
 * at a time and can genuinely end up half-stored. Two things soften that: each
 * seat is retried through a transient failure, and a party that still ends up
 * short throws `PartialRsvpError` rather than a bare API error, so the log
 * names the shortfall instead of only the cause.
 */
export async function createRsvp({ email, seats }: RsvpSubmission) {
  if (!RSVP_DATA_SOURCE_ID) {
    throw new Error("NOTION_RSVP_DATA_SOURCE_ID is not configured");
  }

  // Every row from one POST carries the same id, so a party that replied
  // together can be grouped again in Notion — the rows are otherwise
  // indistinguishable from ten separate people replying at the same moment.
  const submission = crypto.randomUUID();
  const submittedAt = new Date().toISOString();
  const pageIds: Array<string> = [];

  // Sequential rather than Promise.all: Notion rate-limits to roughly three
  // requests a second, and a full ten-seat party would burst past that.
  for (const [index, seat] of seats.entries()) {
    try {
      const page = await createSeat({
        dataSourceId: RSVP_DATA_SOURCE_ID,
        seat,
        index,
        email,
        submission,
        submittedAt,
      });
      pageIds.push(page.id);
    } catch (error) {
      // Seat one failing means nothing was written: that is a clean failure
      // and the original error describes it best. Anything later leaves rows
      // behind, and the caller needs to be told that, not just why.
      if (pageIds.length === 0) throw error;

      throw new PartialRsvpError(submission, pageIds.length, seats.length, {
        cause: error,
      });
    }
  }

  return { submission, pageIds };
}

/** One seat, attempted until Notion accepts it or stops being worth asking. */
async function createSeat({
  dataSourceId,
  seat,
  index,
  email,
  submission,
  submittedAt,
}: {
  dataSourceId: string;
  seat: Seat;
  index: number;
  email: string;
  submission: string;
  submittedAt: string;
}) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await notion.pages.create({
        parent: { type: "data_source_id", data_source_id: dataSourceId },
        properties: {
          Name: { title: [{ text: { content: seat.name } }] },
          Attending: { select: { name: seat.attending ? "Yes" : "No" } },
          "Plus-one requested": { checkbox: seat.plusOne },
          "Plus-one name": {
            rich_text: seat.plusOneName
              ? [{ text: { content: seat.plusOneName } }]
              : [],
          },
          Email: { email },
          // The order the guest listed their party in, which is meaningful:
          // the first seat is usually the person replying.
          Seat: { number: index + 1 },
          Submission: { rich_text: [{ text: { content: submission } }] },
          "Submitted at": { date: { start: submittedAt } },
          Triage: { select: { name: "New" } },
        },
      });
    } catch (error) {
      lastError = error;

      // A validation error, a bad key or a renamed column will fail exactly
      // the same way on every attempt. Retrying those only makes the guest
      // wait longer for the same answer.
      if (!isRetryable(error) || attempt === MAX_ATTEMPTS) throw error;

      const delay = retryDelayMs(error, attempt);
      console.warn(
        `Retrying seat ${index + 1} of RSVP ${submission} in ${delay}ms ` +
          `(attempt ${attempt} of ${MAX_ATTEMPTS}):`,
        error,
      );
      await sleep(delay);
    }
  }

  throw lastError;
}

export async function getPosts(): Promise<Array<Post>> {
  const dataSource = await getDataSource();
  const filter = publicationFilter(dataSource.properties);
  const response = await notion.dataSources.query({
    data_source_id: dataSource.id,
    filter,
    sorts: sortForPosts(dataSource.properties),
    result_type: "page",
  });

  const posts: Array<Post> = [];

  for (const page of response.results) {
    // `result_type: "page"` should keep data sources out of the results, but
    // the SDK types them as possible, and they also carry `properties`.
    if (page.object !== "page" || !("properties" in page)) continue;

    const blocks = await getPageBlocks(page.id);
    const post = postFromPage(page, dataSource.properties, blocks);
    if (post) posts.push(post);
  }

  return posts;
}

export type { Block, Post, RichText };

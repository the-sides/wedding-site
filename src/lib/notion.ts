import { Client } from "@notionhq/client";
import {
  NOTION_API_KEY,
  NOTION_DATABASE_ID,
  NOTION_DATA_SOURCE_ID,
} from "astro:env/server";
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

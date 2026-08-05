import { useRef, useState } from "react";
// React 19 deprecated the recipe's `FormEvent` ("it doesn't actually exist")
// in favour of the concrete DOM event types.
import type { SubmitEvent } from "react";

const MAX_SEATS = 10;

export default function Form() {
  // Seats are tracked by stable id, never by array index: with index keys,
  // removing a middle seat makes React reuse the wrong DOM node and the
  // remaining (uncontrolled) inputs appear to shift their values up a row.
  const [seatIds, setSeatIds] = useState<Array<number>>([0]);
  const [responseMessage, setResponseMessage] = useState("");
  const [pending, setPending] = useState(false);

  // A deterministic counter rather than crypto.randomUUID(): this component is
  // server-rendered to HTML before it hydrates, and a random initial id would
  // differ between those two passes and cause a hydration mismatch. It only
  // advances on user interaction, which happens after hydration.
  const nextId = useRef(1);
  // Set by addSeat so the freshly rendered input can claim focus once.
  const focusId = useRef<number | null>(null);

  function addSeat() {
    if (seatIds.length >= MAX_SEATS) return;
    const id = nextId.current++;
    focusId.current = id;
    setSeatIds((ids) => [...ids, id]);
  }

  function removeSeat(id: number) {
    // Never let the party drop to zero seats.
    setSeatIds((ids) => (ids.length === 1 ? ids : ids.filter((x) => x !== id)));
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    // Read the DOM before the first await — currentTarget is only valid
    // during the synchronous part of the handler.
    const formData = new FormData(event.currentTarget);
    setPending(true);
    try {
      const response = await fetch("/api/rsvp", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      setResponseMessage(data.message ?? "");
    } catch {
      setResponseMessage("Something went wrong — please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-24 mx-auto max-w-6xl">
      <div className="mb-8 flex items-end justify-between gap-6 border-b border-[#221812]/15 pb-5">
        <div>
          <p className="font-['Avenir_Next','Gill_Sans',sans-serif] text-xs uppercase tracking-[0.26em] text-[#9b6e38]">
            Invite
          </p>
          <h2 className="mt-2 font-['Bodoni_72','Didot','Baskerville',serif] text-5xl leading-none text-[#221812] sm:text-6xl">
            RSVP
          </h2>

          <form
            className="mt-4 grid grid-cols-2 justify-start gap-3"
            onSubmit={submit}
          >
            {/* One <li> per seat. Party size is the row count, never typed. */}
            <div>
              <ol className="col-span-2 grid gap-3">
                {seatIds.map((id) => (
                  <li key={id} className="flex flex-col justify-end">
                    <label>
                      Name:
                      <input
                        ref={(node) => {
                          if (node && focusId.current === id) {
                            node.focus();
                            focusId.current = null;
                          }
                        }}
                        className="ml-3 border rounded-xs border-[#b0aaa3] bg-[#fff8ee]/58"
                        type="text"
                        name="guest"
                        autoComplete="off"
                        required
                      />
                    </label>
                    <p className="flex justify-end gap-x-5">
                      Will attend:
                      <label>
                        <input
                          ref={(node) => {
                            if (node && focusId.current === id) {
                              node.focus();
                              focusId.current = null;
                            }
                          }}
                          className="ml-3 border rounded-xs border-[#b0aaa3] bg-[#fff8ee]/58"
                          type="radio"
                          name="guest"
                          autoComplete="off"
                          required
                        />
                        Yes
                      </label>
                      <label>
                        <input
                          ref={(node) => {
                            if (node && focusId.current === id) {
                              node.focus();
                              focusId.current = null;
                            }
                          }}
                          className="ml-3 border rounded-xs border-[#b0aaa3] bg-[#fff8ee]/58"
                          type="radio"
                          name="guest"
                          autoComplete="off"
                          required
                        />
                        No
                      </label>
                    </p>
                    <p className="flex justify-end gap-x-5">
                      Requesting +1:
                      <label>
                        <input
                          ref={(node) => {
                            if (node && focusId.current === id) {
                              node.focus();
                              focusId.current = null;
                            }
                          }}
                          className="ml-3 border rounded-xs border-[#b0aaa3] bg-[#fff8ee]/58"
                          type="radio"
                          name="guest"
                          autoComplete="off"
                          required
                        />
                      </label>
                      Yes
                      <label>
                        <input
                          ref={(node) => {
                            if (node && focusId.current === id) {
                              node.focus();
                              focusId.current = null;
                            }
                          }}
                          className="ml-3 border rounded-xs border-[#b0aaa3] bg-[#fff8ee]/58"
                          type="radio"
                          name="guest"
                          autoComplete="off"
                          required
                        />
                        No
                      </label>
                    </p>
                    <button
                      type="button"
                      onClick={() => removeSeat(id)}
                      disabled={seatIds.length === 1}
                      className="ml-auto text-xs uppercase tracking-[0.18em] text-[#6f5a45] disabled:invisible"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ol>
              <button
                type="button"
                onClick={addSeat}
                disabled={seatIds.length >= MAX_SEATS}
                className="mt-4 col-span-2 justify-self-start hover:bg-[#bbb6af] border border-teal-900 pl-4 pr-4 text-left disabled:cursor-not-allowed disabled:opacity-40"
              >
                + Add another name
              </button>
            </div>

            <label>
              Email:
              <input
                className="ml-3 border rounded-xs border-[#b0aaa3] bg-[#fff8ee]/58"
                type="email"
                name="email"
                autoComplete="email"
                required
              />
            </label>

            <button
              disabled={pending}
              className="ml-auto hover:bg-[#bbb6af] border text-left px-4 border-teal-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending ? "Sending…" : "Submit"}
            </button>

            {responseMessage && (
              <p
                className="col-span-2 font-['Avenir_Next','Gill_Sans',sans-serif] text-sm text-[#6f5a45]"
                aria-live="polite"
              >
                {responseMessage}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

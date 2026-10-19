import type { FieldState } from "./cloth/field";

/**
 * Submits the notice's sign-up without leaving the page. Works the same
 * whether the form is drawn into the cloth or shown flat; the cloth listens
 * for `subscribechange` to reprint itself.
 */
export function enableSubscribeForm(form: HTMLFormElement) {
  const input = form.querySelector<HTMLInputElement>("input[name=email]")!;
  const button = form.querySelector<HTMLButtonElement>("button")!;
  const status = form.querySelector<HTMLElement>("[data-subscribe-status]")!;
  const hint = status.textContent ?? "";
  function set(state: FieldState, message = hint) {
    form.dataset.state = state;
    status.textContent = message;
    form.dispatchEvent(new Event("subscribechange"));
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const state = form.dataset.state;
    if (state === "sending" || state === "done") return;
    input.value = input.value.trim();
    // Validate here rather than with the browser's bubble, which would point
    // at an input nobody can see while the cloth is drawing it.
    if (!input.value || !input.checkValidity()) {
      set("error", "That email doesn’t look quite right.");
      return;
    }
    set("sending", "Sending…");
    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { accept: "application/json" },
      });
      const { message } = (await response.json()) as { message: string };
      if (!response.ok) return set("error", message);
      input.readOnly = true;
      button.disabled = true;
      set("done", message);
    } catch {
      set("error", "We couldn’t reach the site — please try again.");
    }
  });
  input.addEventListener("input", () => {
    if (form.dataset.state === "error") set("idle");
  });
}

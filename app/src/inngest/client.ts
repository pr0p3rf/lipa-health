import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "lipa-health",
  eventKey: process.env.INNGEST_EVENT_KEY,
});

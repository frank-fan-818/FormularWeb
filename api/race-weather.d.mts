import type { IncomingMessage, ServerResponse } from 'node:http';
type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;
export function createRaceWeatherHandler(options?: { env?: Record<string, string | undefined> }): Handler;
declare const handler: Handler;
export default handler;

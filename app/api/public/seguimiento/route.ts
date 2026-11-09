import { readPublicTracking, trackingReply, trackingFailure } from '@/lib/server/publicTracking'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try { return trackingReply(await readPublicTracking(request)) }
  catch (error) { return trackingFailure(error) }
}

import { withBotId } from 'botid/next/config';
import type { NextConfig } from "next";
import { publicFormFrameOrigin } from './lib/utils/publicFormEmbed';

const nextConfig: NextConfig = {
  async headers() {
    const origin = publicFormFrameOrigin(process.env.ALLOWED_FRAME_ORIGIN);
    const headers = [{ source: '/q/:path*', headers: [{ key: 'Content-Security-Policy', value: "frame-ancestors 'self'" }] }];
    // El seguimiento privado no hereda el permiso de incrustación del formulario.
    return origin ? [...headers, {
      source: '/q/:token([0-9a-f]{32})',
      has: [{ type: 'query', key: 'embed', value: '1' }],
      headers: [{ key: 'Content-Security-Policy', value: `frame-ancestors 'self' ${origin}` }],
    }] : headers;
  },
};

export default withBotId(nextConfig);

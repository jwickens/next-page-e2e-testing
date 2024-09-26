export default function handler(req, res) {
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === 'production') {
    res.status(401).end('Not allowed');
    return;
  }
  res.setPreviewData(JSON.parse(req.cookies.testInfo));
  res.end('draft mode enabled');
}

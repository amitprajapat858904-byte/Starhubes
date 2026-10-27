export function onRequest() {
  return Response.json({
    ok: true,
    message: "StarHubes API is running"
  });
}

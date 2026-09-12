const providers = Object.freeze({calendars:'google',select_calendars:'google',repositories:'github',select_repository:'github'});

// Keep the API's required provider with the action so individual controls cannot
// accidentally omit it (or route a calendar operation to a GitHub connection).
export function requestIntegration(request, payload) {
  const required = providers[payload.action];
  if (required && payload.provider && payload.provider !== required) {
    throw new Error('외부 연결 종류와 요청이 일치하지 않습니다.');
  }
  const body = required ? {...payload,provider:required} : {...payload};
  if (['connect','disconnect','sync'].includes(body.action) && !['google','github'].includes(body.provider)) {
    throw new Error('외부 연결 종류를 선택해 주세요.');
  }
  return request('coach-integrations',body);
}

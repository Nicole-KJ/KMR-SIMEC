function log(level, context, error, extra) {
  const payload = { message: error?.message ?? String(error), ...extra }
  console[level](`[SIMEC] ${context}`, payload, error)
}

export function logError(context, error, extra) {
  log('error', context, error, extra)
}

export function logWarn(context, error, extra) {
  log('warn', context, error, extra)
}

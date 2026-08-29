export function toLabelMap(items) {
  return Object.fromEntries(items.map(i => [i.key, i.label]))
}

export function getFilteredStack(): string[] {
  const stack = new Error().stack!;

  return stack
    .split('\n')
    .slice(1)
    .filter(
      (s) =>
        s.indexOf('StackTools') === -1 &&
        s.indexOf('node:') === -1 &&
        s.indexOf('node_modules') === -1 &&
        s.indexOf('Logger') === -1,
    );
}

export function getClassAndMethod(splitStack?: string[]) {
  splitStack ??= getFilteredStack();

  for (let i = 0; i < splitStack.length; i++) {
    const item = splitStack[i];
    const match = item.match(/at\s+(?<className>[^\s(]+)\.(?<methodName>[^\s(]*)\s+\(\/.*$/);
    if (match) return { class: match?.groups?.className, method: match?.groups?.methodName };
  }

  return { class: undefined, method: undefined };
}

export function getClasslessMethodName(splitStack?: string[]) {
  splitStack ??= getFilteredStack();

  let isAnonymousFn = false;

  for (let i = 0; i < splitStack.length; i++) {
    const item = splitStack[i];

    if (item.indexOf('<anonymous>') !== -1) {
      isAnonymousFn = true;
      continue;
    } else if (item.indexOf('logMessage') !== -1) {
      continue;
    }

    const match = item.match(/at\s+(?<methodName>[^\s\\.(]*)\s+\(\/.*$/);
    if (match) return `${match?.groups?.methodName}${isAnonymousFn ? '.<anonymous>' : ''}`;
  }

  return undefined;
}

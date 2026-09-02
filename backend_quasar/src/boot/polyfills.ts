// 兼容老 WebView（Chromium 72）：esbuild 只降级语法、不补 API。
// Quasar 框架自身及构建产物会用到以下新 API，必须在此注入 polyfill。
// 本文件必须排在 boot 数组最前面。

// Object.hasOwn (ES2022)，Quasar client 里大量使用
if (typeof Object.hasOwn !== 'function') {
  Object.hasOwn = (obj: object, key: PropertyKey) =>
    Object.prototype.hasOwnProperty.call(obj, key);
}

// Array.prototype.at (ES2022)
if (!Array.prototype.at) {
  Array.prototype.at = function (n: number) {
    n = Math.trunc(n) || 0;
    if (n < 0) n += this.length;
    return n < 0 || n >= this.length ? undefined : this[n];
  };
}

// String.prototype.replaceAll (ES2021)
if (!String.prototype.replaceAll) {
  String.prototype.replaceAll = function (
    search: string | RegExp,
    replacement: string,
  ) {
    if (search instanceof RegExp) {
      if (!search.global) throw new TypeError('replaceAll: 正则必须带 g 标志');
      return this.replace(
        search,
        replacement.replace(/\$/g, '$$$$'),
      );
    }
    return this.split(search).join(replacement);
  };
}

// Promise.allSettled (ES2020)
if (!Promise.allSettled) {
  Promise.allSettled = ((promises: Iterable<Promise<unknown>>) =>
    Promise.all(
      Array.from(promises, (p) =>
        p.then(
          (value) => ({ status: 'fulfilled' as const, value }),
          (reason) => ({ status: 'rejected' as const, reason }),
        ),
      ),
    )) as PromiseConstructor['allSettled'];
}

export function nextPage(el: HTMLElement): void {
  el.scrollBy({ left: el.clientWidth })
}

export function prevPage(el: HTMLElement): void {
  el.scrollBy({ left: -el.clientWidth })
}

export function canNext(el: HTMLElement): boolean {
  return el.scrollLeft + el.clientWidth < el.scrollWidth - 4
}

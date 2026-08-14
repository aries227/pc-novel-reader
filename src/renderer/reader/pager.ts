export function nextPage(el: HTMLElement): void {
  el.scrollBy({ left: el.clientWidth })
}

export function prevPage(el: HTMLElement): void {
  el.scrollBy({ left: -el.clientWidth })
}

export function canNext(el: HTMLElement): boolean {
  return el.scrollLeft + el.clientWidth < el.scrollWidth - 4
}

export function nextVerticalPage(el: HTMLElement): void {
  el.scrollBy({ top: el.clientHeight })
}

export function prevVerticalPage(el: HTMLElement): void {
  el.scrollBy({ top: -el.clientHeight })
}

export function canNextVertical(el: HTMLElement): boolean {
  return el.scrollTop + el.clientHeight < el.scrollHeight - 4
}

export function canPrevVertical(el: HTMLElement): boolean {
  return el.scrollTop > 4
}

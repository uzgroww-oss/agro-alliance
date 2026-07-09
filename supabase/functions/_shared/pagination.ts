import { PAGINATION } from "./constants.ts"

export interface PaginationInput {
  page: number
  perPage: number
}

export interface PaginationOutput {
  page: number
  per_page: number
  total: number
  total_pages: number
}

export function parsePagination(url: URL): Required<PaginationInput> {
  const page = Math.max(
    PAGINATION.DEFAULT_PAGE,
    parseInt(url.searchParams.get("page") ?? String(PAGINATION.DEFAULT_PAGE), 10),
  )
  const perPage = Math.min(
    PAGINATION.MAX_PER_PAGE,
    Math.max(
      PAGINATION.DEFAULT_PER_PAGE,
      parseInt(url.searchParams.get("per_page") ?? String(PAGINATION.DEFAULT_PER_PAGE), 10),
    ),
  )
  return { page, perPage }
}

export function paginationMeta(total: number, input: PaginationInput): PaginationOutput {
  return {
    page: input.page,
    per_page: input.perPage,
    total,
    total_pages: Math.ceil(total / input.perPage),
  }
}

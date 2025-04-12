export interface Pageable {
    page: number;
    size: number;
}

export interface Page<T> {
    content: T[];
    pageable: Pageable;
    totalElements: number;
    totalPages: number;
}
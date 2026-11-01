'use client';
import { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Grid2X2,
  List,
  SlidersHorizontal,
  Search,
  X,
} from 'lucide-react';
import { createClient } from '@/lib/client';
import { localized, type Bootstrap, type CatalogResult } from '@/lib/types';
import type { TranslationKey } from '@/lib/i18n';
import { ProductCard } from './product-card';
import { Empty, ErrorState, Loading } from './ui';
export function CatalogView({
  bootstrap,
  apiBase,
  initialSearch,
  initialCategory,
  initialSort = 'newest',
  initialAvailability = '',
  lang,
  t,
  renderProduct,
}: {
  bootstrap: Bootstrap;
  apiBase: string;
  initialSearch: string;
  initialCategory: string;
  initialSort?: string;
  initialAvailability?: string;
  lang: 'uz' | 'ru' | 'en';
  t: (key: TranslationKey) => string;
  renderProduct: (props: {
    product: CatalogResult['products'][number];
    list?: boolean;
  }) => React.ReactNode;
}) {
  const [query, setQuery] = useState(initialSearch),
    [category, setCategory] = useState(initialCategory);
  const [filters, setFilters] = useState<Record<string, string>>({
      availability: initialAvailability,
    }),
    [sort, setSort] = useState(initialSort),
    [page, setPage] = useState(1),
    [layout, setLayout] = useState('grid'),
    [showFilters, setShowFilters] = useState(false);
  const [result, setResult] = useState<CatalogResult | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    setQuery(initialSearch);
    setCategory(initialCategory);
    setPage(1);
  }, [initialSearch, initialCategory]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({
        q: query,
        category,
        sort,
        page: String(page),
        limit: '12',
      });
      for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
      try {
        const data = await createClient(apiBase).request<CatalogResult>('/products?' + params, {
          signal: controller.signal,
        });
        if (!controller.signal.aborted) setResult(data);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Xatolik');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, category, filters, sort, page, apiBase, revision]);
  const update = (key: string, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };
  const reset = () => {
    setFilters({});
    setCategory('');
    setQuery('');
    setPage(1);
  };
  const range = (key: 'thickness' | 'length' | 'diameter') => (
    <fieldset className="filter-range">
      <legend>{t(key)}</legend>
      <div>
        <input
          type="number"
          min="0"
          step="any"
          placeholder={t('from')}
          aria-label={`${t(key)} ${t('from')}`}
          value={filters[key + 'Min'] || ''}
          onChange={(e) => update(key + 'Min', e.target.value)}
        />
        <span>—</span>
        <input
          type="number"
          min="0"
          step="any"
          placeholder={t('to')}
          aria-label={`${t(key)} ${t('to')}`}
          value={filters[key + 'Max'] || ''}
          onChange={(e) => update(key + 'Max', e.target.value)}
        />
      </div>
    </fieldset>
  );
  return (
    <div className="page-container catalog-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t('catalog')}</span>
          <h1>
            {category
              ? localized(
                  bootstrap.categories.find((c) => c.id === category)?.name || {
                    uz: t('allCategories'),
                  },
                  lang,
                )
              : t('allCategories')}
          </h1>
          <p>{t('catalogSubtitle')}</p>
        </div>
        <span className="count-pill">
          {result?.total || 0} {t('productsFound')}
        </span>
      </div>
      <div className="catalog-toolbar">
        <div className="search-field">
          <Search size={19} />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder={t('search')}
            aria-label={t('search')}
          />
          {query && (
            <button className="icon-button" onClick={() => setQuery('')} aria-label={t('reset')}>
              <X size={16} />
            </button>
          )}
        </div>
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(1);
          }}
          aria-label={t('sort')}
        >
          <option value="newest">{t('sortNew')}</option>
          <option value="popular">{t('sortPopular')}</option>
          <option value="price-asc">{t('sortPriceAsc')}</option>
          <option value="price-desc">{t('sortPriceDesc')}</option>
        </select>
        <div className="layout-toggle">
          <button
            className={layout === 'grid' ? 'active' : ''}
            onClick={() => setLayout('grid')}
            aria-label={t('grid')}
          >
            <Grid2X2 size={18} />
          </button>
          <button
            className={layout === 'list' ? 'active' : ''}
            onClick={() => setLayout('list')}
            aria-label={t('list')}
          >
            <List size={19} />
          </button>
        </div>
        <button
          className="button secondary filter-toggle"
          onClick={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal size={17} />
          {t('filters')}
        </button>
      </div>
      <div className="catalog-layout">
        <aside className={`catalog-filters ${showFilters ? 'show' : ''}`}>
          <div className="filter-heading">
            <h3>{t('filters')}</h3>
            <button onClick={reset}>{t('reset')}</button>
          </div>
          <label>
            {t('categories')}
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t('allCategories')}</option>
              {bootstrap.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {localized(c.name, lang)}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>{t('price')}</legend>
            <div className="filter-range">
              <div>
                <input
                  type="number"
                  min="0"
                  placeholder={t('from')}
                  aria-label={`${t('price')} ${t('from')}`}
                  value={filters.minPrice || ''}
                  onChange={(e) => update('minPrice', e.target.value)}
                />
                <span>—</span>
                <input
                  type="number"
                  min="0"
                  placeholder={t('to')}
                  aria-label={`${t('price')} ${t('to')}`}
                  value={filters.maxPrice || ''}
                  onChange={(e) => update('maxPrice', e.target.value)}
                />
              </div>
            </div>
          </fieldset>
          <label>
            {t('availability')}
            <select
              value={filters.availability || ''}
              onChange={(e) => update('availability', e.target.value)}
            >
              <option value="">{t('all')}</option>
              <option value="in">{t('inStock')}</option>
              <option value="out">{t('outOfStock')}</option>
              <option value="discount">{t('discounts')}</option>
            </select>
          </label>
          <label>
            {t('productType')}
            <select
              value={filters.material || ''}
              onChange={(e) => update('material', e.target.value)}
            >
              <option value="">{t('all')}</option>
              {result?.materials.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          {range('thickness')}
          {range('length')}
          {range('diameter')}
        </aside>
        <div className="catalog-results">
          {error ? (
            <ErrorState
              message={error}
              retry={() => setRevision((x) => x + 1)}
              label={t('retry')}
            />
          ) : loading && !result ? (
            <Loading label={t('loading')} />
          ) : !result?.products.length ? (
            <Empty
              title={t('emptyProducts')}
              text={t('emptyProductsText')}
              action={t('clearFilters')}
              onAction={reset}
            />
          ) : (
            <div
              className={`product-grid ${layout === 'list' ? 'list-layout' : ''} ${loading ? 'is-refreshing' : ''}`}
            >
              {result.products.map((product) => (
                <div key={product.id}>{renderProduct({ product, list: layout === 'list' })}</div>
              ))}
            </div>
          )}
          {result && result.pages > 1 && (
            <div className="pagination">
              <button
                className="button secondary"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft size={17} />
                {t('previous')}
              </button>
              <span>
                {page} / {result.pages}
              </span>
              <button
                className="button secondary"
                disabled={page >= result.pages}
                onClick={() => setPage(page + 1)}
              >
                {t('next')}
                <ChevronRight size={17} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

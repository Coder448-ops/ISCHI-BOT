'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Headphones,
  Heart,
  Layers3,
  Menu,
  MessageCircle,
  Minus,
  Moon,
  PackageCheck,
  Phone,
  Plus,
  Ruler,
  Scale,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sun,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { createClient, readLocal, validCart, validReceipts, writeLocal } from '@/lib/client';
import { translate, type TranslationKey } from '@/lib/i18n';
import { groupNumber, money, unitLabel, formatPhone, formatDate } from '@/lib/money';
import {
  availability,
  effectivePrice,
  localized,
  type Bootstrap,
  type CartLine,
  type Language,
  type Order,
  type Product,
  type Receipt,
} from '@/lib/types';
import { Brand, Empty, ErrorState, Loading, Modal } from './ui';
import { ProductCard } from './product-card';
import { CatalogView } from './catalog-view';
import { ProductDetail } from './product-detail';

type Quote = {
  items: {
    productId: string;
    name: string;
    image: string;
    quantity: number;
    unit: Product['unit'];
    unitPrice: number;
    originalPrice: number;
    total: number;
  }[];
  subtotal: number;
  discount: number;
  total: number;
  couponCode: string | null;
};
const infoPages = [
  'about',
  'contact',
  'delivery',
  'payment',
  'privacy',
  'faq',
  'install',
  'favorites',
  'compare',
  'recent',
  'orders',
  'checkout',
] as const;
export function StoreApp({
  apiBase = '',
  mobile = false,
  initialPath = '/',
}: {
  apiBase?: string;
  mobile?: boolean;
  initialPath?: string;
}) {
  const client = useMemo(() => createClient(apiBase), [apiBase]);
  const [path, setPath] = useState(initialPath),
    [bootstrap, setBootstrap] = useState<Bootstrap | null>(null),
    [error, setError] = useState(''),
    [lang, setLang] = useState<Language>('uz'),
    [theme, setTheme] = useState('light');
  const [cart, updateCart] = useState<CartLine[]>([]),
    [favorites, setFavorites] = useState<string[]>([]),
    [compare, setCompare] = useState<string[]>([]),
    [recent, setRecent] = useState<string[]>([]),
    [receipts, setReceipts] = useState<Receipt[]>([]);
  const [cartOpen, setCartOpen] = useState(false),
    [menuOpen, setMenuOpen] = useState(false),
    [categoriesOpen, setCategoriesOpen] = useState(false),
    [toast, setToast] = useState(''),
    [hydrated, setHydrated] = useState(false);
  const [search, setSearch] = useState(''),
    [suggestions, setSuggestions] = useState<Product[]>([]),
    [searchOpen, setSearchOpen] = useState(false);
  const [savedProducts, setSavedProducts] = useState<Product[]>([]),
    [quote, setQuote] = useState<Quote | null>(null),
    [quoteError, setQuoteError] = useState(''),
    [coupon, setCoupon] = useState(''),
    [couponInput, setCouponInput] = useState(''),
    [quoteLoading, setQuoteLoading] = useState(false);
  const [checkoutName, setCheckoutName] = useState(''),
    [checkoutPhone, setCheckoutPhone] = useState(''),
    [checkoutBusy, setCheckoutBusy] = useState(false),
    [checkoutError, setCheckoutError] = useState(''),
    [confirmation, setConfirmation] = useState<{ order: Order; receiptToken: string } | null>(null);
  const requestId = useRef(''),
    quoteRevision = useRef(0),
    toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setCart = useCallback((value: CartLine[] | ((items: CartLine[]) => CartLine[])) => {
    requestId.current = '';
    updateCart(value);
  }, []);
  const applyCoupon = (value: string) => {
    requestId.current = '';
    setCoupon(value);
  };
  const t = useCallback((key: TranslationKey) => translate(lang, key), [lang]);
  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  }, []);
  const navigate = useCallback(
    (next: string) => {
      const normalized = next.startsWith('/') ? next : '/' + next;
      if (mobile) window.location.hash = normalized;
      else window.history.pushState({}, '', normalized);
      setPath(normalized);
      setMenuOpen(false);
      setCategoriesOpen(false);
      setSearchOpen(false);
      setCartOpen(false);
      setMenuOpen(false);
      window.scrollTo({ top: 0, behavior: 'instant' });
    },
    [mobile],
  );
  const href = (next: string) => (mobile ? '#' + next : next);
  const link = (next: string) => ({
    href: href(next),
    onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (!event.metaKey && !event.ctrlKey && !event.shiftKey) {
        event.preventDefault();
        navigate(next);
      }
    },
  });
  useEffect(() => {
    const storedLang = readLocal<string>('language', 'uz');
    if (['uz', 'ru', 'en'].includes(storedLang)) setLang(storedLang as Language);
    setTheme(
      readLocal<string>(
        'theme',
        window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      ),
    );
    setCart(validCart(readLocal('cart', [])));
    setReceipts(validReceipts(readLocal('receipts', [])));
    for (const [key, setter] of [
      ['favorites', setFavorites],
      ['compare', setCompare],
      ['recent', setRecent],
    ] as const) {
      const value = readLocal<unknown>(key, []);
      if (Array.isArray(value))
        setter(value.filter((x) => typeof x === 'string').slice(0, key === 'compare' ? 4 : 100));
    }
    if (mobile && window.location.hash.startsWith('#/')) setPath(window.location.hash.slice(1));
    setHydrated(true);
    const onPop = () => {
      setPath(
        mobile
          ? window.location.hash.slice(1) || '/'
          : window.location.pathname + window.location.search,
      );
      setCartOpen(false);
      setMenuOpen(false);
    };
    window.addEventListener(mobile ? 'hashchange' : 'popstate', onPop);
    return () => window.removeEventListener(mobile ? 'hashchange' : 'popstate', onPop);
  }, [mobile]);
  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.lang = lang;
    document.documentElement.dataset.theme = theme;
    writeLocal('language', lang);
    writeLocal('theme', theme);
    writeLocal('cart', cart);
    writeLocal('favorites', favorites);
    writeLocal('compare', compare);
    writeLocal('recent', recent);
    writeLocal('receipts', receipts);
  }, [hydrated, lang, theme, cart, favorites, compare, recent, receipts]);
  const loadBootstrap = useCallback(async () => {
    setError('');
    try {
      setBootstrap(await client.get<Bootstrap>('/bootstrap'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xatolik');
    }
  }, [client]);
  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);
  useEffect(() => {
    if (!mobile) return;
    let remove: (() => void) | undefined;
    void (async () => {
      try {
        const { App } = await import('@capacitor/app');
        const { KeyboardResize } = await import('@capacitor/keyboard');
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        const { SplashScreen } = await import('@capacitor/splash-screen');
        const { Keyboard } = await import('@capacitor/keyboard');
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#17191b' });
        await Keyboard.setResizeMode({ mode: KeyboardResize.Native }).catch(() => undefined);
        const back = await App.addListener('backButton', ({ canGoBack }) => {
          if (cartOpen) setCartOpen(false);
          else if (menuOpen) setMenuOpen(false);
          else if (path !== '/' && canGoBack) window.history.back();
          else if (path !== '/') navigate('/');
          else void App.minimizeApp();
        });
        const deep = await App.addListener('appUrlOpen', ({ url }) => {
          try {
            const parsed = new URL(url);
            navigate(parsed.pathname + parsed.search);
          } catch {
            /* Ignore malformed external links. */
          }
        });
        remove = () => {
          void back.remove();
          void deep.remove();
        };
        await SplashScreen.hide();
      } catch {
        /* Browser preview does not provide native plugins. */
      }
    })();
    return () => remove?.();
  }, [mobile, path, cartOpen, menuOpen, navigate]);
  const route = path.split('?')[0],
    params = new URLSearchParams(path.split('?')[1] || '');
  const productId = route.startsWith('/product/') ? decodeURIComponent(route.slice(9)) : '';
  useEffect(() => {
    if (productId)
      setRecent((items) => [productId, ...items.filter((x) => x !== productId)].slice(0, 24));
  }, [productId]);
  const savedKey = [...favorites, ...compare, ...recent, ...cart.map((line) => line.productId)]
    .filter((x, i, a) => a.indexOf(x) === i)
    .sort()
    .join(',');
  useEffect(() => {
    if (!savedKey) {
      setSavedProducts([]);
      return;
    }
    let active = true;
    const ids = savedKey.split(',');
    const chunks = Array.from({ length: Math.ceil(ids.length / 48) }, (_, i) =>
      ids.slice(i * 48, (i + 1) * 48),
    );
    Promise.all(
      chunks.map((chunk) =>
        client.get<{ products: Product[] }>(
          '/products?ids=' + encodeURIComponent(chunk.join(',')) + '&limit=48',
        ),
      ),
    )
      .then((results) => {
        if (active) setSavedProducts(results.flatMap((x) => x.products));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [savedKey, client]);
  useEffect(() => {
    if (search.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(
      () =>
        client
          .request<{ products: Product[] }>(
            '/products?q=' + encodeURIComponent(search) + '&limit=5',
            { signal: controller.signal },
          )
          .then((data) => setSuggestions(data.products))
          .catch(() => undefined),
      200,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, client]);
  useEffect(() => {
    if (!cart.length) {
      setQuote(null);
      setQuoteLoading(false);
      return;
    }
    const revision = ++quoteRevision.current;
    setQuoteLoading(true);
    setQuoteError('');
    const timer = setTimeout(
      () =>
        client
          .post<Quote>('/quote', { items: cart, couponCode: coupon })
          .then((data) => {
            if (revision === quoteRevision.current) setQuote(data);
          })
          .catch((e) => {
            if (revision === quoteRevision.current) {
              setQuote(null);
              setQuoteError(e.message);
            }
          })
          .finally(() => {
            if (revision === quoteRevision.current) setQuoteLoading(false);
          }),
      200,
    );
    return () => clearTimeout(timer);
  }, [cart, coupon, client]);
  const addCart = (product: Product, quantity = product.minOrder, buy = false) => {
    const existing = cart.find((x) => x.productId === product.id)?.quantity || 0;
    const next = existing ? Math.max(product.minOrder, existing + quantity) : quantity;
    if (next > product.stock || !product.enabled) {
      notify(t('outOfStock'));
      return;
    }
    setCart((items) => [
      ...items.filter((x) => x.productId !== product.id),
      { productId: product.id, quantity: Number(next.toFixed(6)) },
    ]);
    requestId.current = '';
    notify(t('added'));
    if (buy) {
      setConfirmation(null);
      navigate('/checkout');
    }
  };
  const toggleFavorite = (id: string) => {
    const exists = favorites.includes(id);
    setFavorites((items) => (exists ? items.filter((x) => x !== id) : [...items, id]));
    notify(t(exists ? 'favoriteRemoved' : 'favoriteAdded'));
  };
  const toggleCompare = (id: string) => {
    if (compare.includes(id)) setCompare((items) => items.filter((x) => x !== id));
    else if (compare.length >= 4) notify(t('compareLimit'));
    else {
      setCompare((items) => [...items, id]);
      notify(t('compareAdded'));
    }
  };
  const renderProduct = ({ product, list = false }: { product: Product; list?: boolean }) => (
    <ProductCard
      product={product}
      lang={lang}
      t={t}
      image={client.image}
      onOpen={() => navigate('/product/' + product.id)}
      onAdd={() => addCart(product)}
      favorite={favorites.includes(product.id)}
      onFavorite={() => toggleFavorite(product.id)}
      compared={compare.includes(product.id)}
      onCompare={() => toggleCompare(product.id)}
      list={list}
    />
  );
  const submitOrder = async (event: FormEvent) => {
    event.preventDefault();
    if (checkoutBusy || quoteLoading || !quote) return;
    if (checkoutName.trim().split(/\s+/).length < 2 || checkoutName.trim().length < 5) {
      setCheckoutError(t('requiredName'));
      return;
    }
    if (!/^998\d{9}$/.test(checkoutPhone.replace(/\D/g, ''))) {
      setCheckoutError(t('requiredPhone'));
      return;
    }
    setCheckoutBusy(true);
    setCheckoutError('');
    requestId.current ||= crypto.randomUUID();
    try {
      const result = await client.post<{ order: Order; receiptToken: string }>('/orders', {
        customerName: checkoutName.trim(),
        phone: checkoutPhone,
        items: cart,
        requestId: requestId.current,
        expectedTotal: quote.total,
        couponCode: coupon || undefined,
      });
      setConfirmation(result);
      setReceipts((items) =>
        [
          { id: result.order.id, number: result.order.number, token: result.receiptToken },
          ...items.filter((x) => x.id !== result.order.id),
        ].slice(0, 50),
      );
      setCart([]);
      applyCoupon('');
      setCheckoutName('');
      setCheckoutPhone('');
      requestId.current = '';
      window.scrollTo(0, 0);
    } catch (e) {
      setCheckoutError(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setCheckoutBusy(false);
    }
  };
  const cartCount = cart.length;
  const searchSubmit = (event: FormEvent) => {
    event.preventDefault();
    navigate('/catalog?q=' + encodeURIComponent(search));
  };
  const section = (title: TranslationKey, items: Product[], target = '/catalog') => (
    <section className="section page-container">
      <div className="section-heading">
        <div>
          <span className="eyebrow">ISCHI INDUSTRIAL</span>
          <h2>{t(title)}</h2>
        </div>
        <a className="text-link" {...link(target)}>
          {t('viewAll')}
          <ArrowUpRight size={17} />
        </a>
      </div>
      {items.length ? (
        <div className="product-grid">
          {items.slice(0, 4).map((product) => (
            <div key={product.id}>{renderProduct({ product })}</div>
          ))}
        </div>
      ) : (
        <div className="quiet-empty">
          <PackageCheck size={22} />
          {t('noSales')}
        </div>
      )}
    </section>
  );
  if (!bootstrap)
    return (
      <div className="store-shell">
        <header className="site-header">
          <div className="page-container header-main">
            <Brand />
          </div>
        </header>
        {error ? (
          <ErrorState message={error} retry={loadBootstrap} label="Qayta urinish" />
        ) : (
          <div className="homepage-skeleton">
            <div className="skeleton hero-skeleton" />
            <div className="page-container skeleton-cards">
              {[1, 2, 3, 4].map((i) => (
                <div className="skeleton" key={i} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  const settings = bootstrap.settings;
  const categories = bootstrap.categories;
  const renderHome = () => (
    <>
      <section className="industrial-hero">
        <img
          className="hero-photo"
          src={client.image('/images/banners/industrial-hero.webp')}
          alt=""
          fetchPriority="high"
          width="1800"
          height="1024"
        />
        <div className="hero-shade" />
        <div className="page-container hero-content">
          <span className="hero-eyebrow">
            <span />
            {t('heroEyebrow')}
          </span>
          <h1>{t('heroTitle')}</h1>
          <p>{t('heroText')}</p>
          <div className="hero-actions">
            <a className="button primary large" {...link('/catalog')}>
              {t('viewCatalog')}
              <ArrowRight size={19} />
            </a>
            <a className="hero-secondary" {...link('/about')}>
              {t('about')}
              <ArrowUpRight size={17} />
            </a>
          </div>
          <div className="hero-assurance">
            <ShieldCheck size={18} />
            {t('accountFree')}
            <span /> {t('heroNote')}
          </div>
        </div>
        <div className="hero-index">
          <span>01</span>
          <i />
          MATERIALS FOR BUILDING
        </div>
      </section>
      <div className="category-strip page-container">
        {(['metal', 'construction'] as const).map((group, index) => (
          <a
            key={group}
            className="category-feature"
            {...link('/catalog?category=' + (categories.find((c) => c.group === group)?.id || ''))}
          >
            <div className="category-feature-icon">
              {index === 0 ? <Layers3 size={29} /> : <PackageCheck size={29} />}
            </div>
            <div>
              <span className="eyebrow">
                0{index + 1} / {categories.filter((c) => c.group === group).length}{' '}
                {t('categories').toLowerCase()}
              </span>
              <h3>{t(group)}</h3>
            </div>
            <ArrowUpRight size={24} />
          </a>
        ))}
      </div>
      {section('popular', bootstrap.home.popular)}
      <section className="advantages-band">
        <div className="page-container">
          <div className="section-heading">
            <h2>{t('advantages')}</h2>
            <span className="eyebrow">BUILT AROUND YOUR PROJECT</span>
          </div>
          <div className="advantages-grid">
            {[
              { icon: ShieldCheck, key: 'advantage1' },
              { icon: Ruler, key: 'advantage2' },
              { icon: Layers3, key: 'advantage3' },
              { icon: Headphones, key: 'advantage4' },
            ].map(({ icon: Icon, key }, i) => (
              <div className="advantage" key={key}>
                <div className="advantage-top">
                  <Icon size={25} />
                  <span>0{i + 1}</span>
                </div>
                <h3>{t(key as TranslationKey)}</h3>
                <p>{t((key + 'Text') as TranslationKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      {section('newest', bootstrap.home.newest, '/catalog?sort=newest')}
      {bootstrap.home.discounts.length > 0 && (
        <section className="offer-banner page-container">
          <div>
            <span className="eyebrow">{t('offers')}</span>
            <h2>{t('discounts')}</h2>
            <p>
              {bootstrap.couponOffer
                ? `${t('coupon')}: ${bootstrap.couponOffer.code} · ${bootstrap.couponOffer.value}${bootstrap.couponOffer.type === 'percent' ? '%' : ' UZS'}`
                : t('catalogSubtitle')}
            </p>
          </div>
          <a className="button dark-button" {...link('/catalog?availability=discount')}>
            {t('viewAll')}
            <ArrowRight size={18} />
          </a>
        </section>
      )}
      {section('discounts', bootstrap.home.discounts, '/catalog?availability=discount')}
      {section('bestsellers', bootstrap.home.bestsellers, '/catalog?sort=popular')}
      <section className="section page-container">
        <div className="section-heading">
          <h2>{t('categories')}</h2>
          <a className="text-link" {...link('/catalog')}>
            {t('allCategories')}
            <ArrowRight size={17} />
          </a>
        </div>
        <div className="category-grid">
          {categories.map((category) => (
            <a key={category.id} {...link('/catalog?category=' + category.id)}>
              <span>{localized(category.name, lang)}</span>
              <ChevronRight size={16} />
            </a>
          ))}
        </div>
      </section>
      <section className="delivery-band">
        <div className="page-container">
          <Truck size={36} />
          <div>
            <h2>{t('delivery')}</h2>
            <p>{localized(settings.delivery, lang)}</p>
          </div>
          <a className="button secondary" {...link('/delivery')}>
            {t('viewDetails')}
            <ArrowRight size={17} />
          </a>
        </div>
      </section>
      <section className="section page-container">
        <div className="section-heading">
          <h2>{t('reviews')}</h2>
        </div>
        {settings.testimonials.filter((x) => x.enabled).length ? (
          <div className="testimonials-grid">
            {settings.testimonials
              .filter((x) => x.enabled)
              .map((review) => (
                <blockquote key={review.id}>
                  <p>“{review.text}”</p>
                  <cite>{review.name}</cite>
                </blockquote>
              ))}
          </div>
        ) : (
          <div className="quiet-empty">
            <MessageCircle size={22} />
            {t('noReviews')}
          </div>
        )}
      </section>
      <section className="section page-container faq-contact-grid">
        <div>
          <span className="eyebrow">FAQ</span>
          <h2>{t('faq')}</h2>
          <div className="faq-list">
            {settings.faq.slice(0, 4).map((item) => (
              <details key={item.id}>
                <summary>
                  {localized(item.question, lang)}
                  <Plus size={17} />
                </summary>
                <p>{localized(item.answer, lang)}</p>
              </details>
            ))}
          </div>
          <a className="text-link" {...link('/faq')}>
            {t('viewAll')}
            <ArrowRight size={16} />
          </a>
        </div>
        <div className="contact-card">
          <Headphones size={32} />
          <h2>{t('contactTitle')}</h2>
          <p>{t('contactText')}</p>
          {settings.phones[0] ? (
            <a className="button primary" href={'tel:' + settings.phones[0]}>
              <Phone size={17} />
              {settings.phones[0]}
            </a>
          ) : (
            <a className="button primary" {...link('/contact')}>
              {t('support')}
              <ArrowRight size={17} />
            </a>
          )}
        </div>
      </section>
    </>
  );
  const renderInfo = () => {
    const key = route.slice(1) as (typeof infoPages)[number];
    if (['favorites', 'compare', 'recent'].includes(key)) {
      const ids = key === 'favorites' ? favorites : key === 'compare' ? compare : recent;
      const items = ids
        .map((id) => savedProducts.find((p) => p.id === id))
        .filter((p): p is Product => !!p);
      return (
        <div className="page-container section">
          <div className="page-heading">
            <h1>{t(key as TranslationKey)}</h1>
            <span className="count-pill">{items.length}</span>
          </div>
          {!items.length ? (
            <Empty
              title={t(
                key === 'favorites'
                  ? 'emptyFavorites'
                  : key === 'compare'
                    ? 'emptyCompare'
                    : 'emptyProducts',
              )}
              action={t('viewCatalog')}
              onAction={() => navigate('/catalog')}
            />
          ) : key === 'compare' ? (
            <div className="comparison-scroll">
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>{t('specifications')}</th>
                    {items.map((p) => (
                      <th key={p.id}>
                        <img src={client.image(p.images[0])} alt="" width="180" height="130" />
                        <a {...link('/product/' + p.id)}>{localized(p.name, lang)}</a>
                        <button
                          className="icon-button"
                          onClick={() => toggleCompare(p.id)}
                          aria-label={t('remove')}
                        >
                          <X size={16} />
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      'price',
                      'unit',
                      'material',
                      'thickness',
                      'length',
                      'diameter',
                      'weight',
                    ] as const
                  ).map((field) => (
                    <tr key={field}>
                      <th>
                        {t(
                          field === 'price'
                            ? 'price'
                            : field === 'unit'
                              ? 'unit'
                              : (field as TranslationKey),
                        )}
                      </th>
                      {items.map((p) => (
                        <td key={p.id}>
                          {field === 'price'
                            ? money(effectivePrice(p), lang)
                            : field === 'unit'
                              ? unitLabel(p.unit, lang)
                              : field === 'material'
                                ? p.materialType
                                : field === 'weight'
                                  ? p.weight === null
                                    ? '—'
                                    : p.weight + ' kg'
                                  : (p.measurements[field] ?? '—') +
                                    (p.measurements[field] !== undefined ? ' mm' : '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="product-grid">
              {items.map((product) => (
                <div key={product.id}>{renderProduct({ product })}</div>
              ))}
            </div>
          )}
        </div>
      );
    }
    if (key === 'orders')
      return (
        <div className="page-container section">
          <div className="page-heading">
            <h1>{t('orders')}</h1>
          </div>
          <p className="muted">{t('saveReceipt')}</p>
          {receipts.length ? (
            <div className="receipt-list">
              {receipts.map((receipt) => (
                <ReceiptCard key={receipt.id} receipt={receipt} client={client} lang={lang} t={t} />
              ))}
            </div>
          ) : (
            <Empty
              title={t('noReceipts')}
              action={t('viewCatalog')}
              onAction={() => navigate('/catalog')}
            />
          )}
        </div>
      );
    if (key === 'install')
      return (
        <div className="page-container section install-page">
          <div className="install-visual">
            <Smartphone size={100} />
            <Brand name={settings.companyName} />
          </div>
          <div>
            <span className="eyebrow">ANDROID APPLICATION</span>
            <h1>{t('installTitle')}</h1>
            <p>{t('installText')}</p>
            <h3>{t('installSteps')}</h3>
            <ol>
              {['installStep1', 'installStep2', 'installStep3'].map((x) => (
                <li key={x}>{t(x as TranslationKey)}</li>
              ))}
            </ol>
            <div className="delivery-note">
              <ShieldCheck size={23} />
              <p>{t('installSafety')}</p>
            </div>
            <a className="button secondary" {...link('/catalog')}>
              {t('viewCatalog')}
              <ArrowRight size={17} />
            </a>
          </div>
        </div>
      );
    if (key === 'faq')
      return (
        <div className="page-container section narrow-page">
          <span className="eyebrow">ISCHI INDUSTRIAL</span>
          <h1>{t('faq')}</h1>
          <div className="faq-list">
            {settings.faq.map((item) => (
              <details key={item.id}>
                <summary>
                  {localized(item.question, lang)}
                  <Plus size={18} />
                </summary>
                <p>{localized(item.answer, lang)}</p>
              </details>
            ))}
          </div>
        </div>
      );
    if (key === 'contact')
      return (
        <div className="page-container section">
          <div className="page-heading">
            <h1>{t('contact')}</h1>
          </div>
          <div className="contact-layout">
            <div className="company-contact">
              <h2>{settings.companyName}</h2>
              <div>
                <Phone size={21} />
                <section>
                  <h3>{t('phone')}</h3>
                  {settings.phones.length ? (
                    settings.phones.map((phone) => (
                      <a key={phone} href={'tel:' + phone}>
                        {phone}
                      </a>
                    ))
                  ) : (
                    <p>{t('notProvided')}</p>
                  )}
                </section>
              </div>
              <div>
                <Clock3 size={21} />
                <section>
                  <h3>{t('workingHours')}</h3>
                  <p>{localized(settings.workingHours, lang)}</p>
                </section>
              </div>
              <div>
                <Layers3 size={21} />
                <section>
                  <h3>{t('address')}</h3>
                  <p>{localized(settings.address, lang)}</p>
                </section>
              </div>
              {settings.whatsapp && (
                <a
                  className="button primary"
                  href={`https://wa.me/${settings.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle size={19} />
                  {t('whatsapp')}
                </a>
              )}
            </div>
            <SupportForm client={client} t={t} />
          </div>
        </div>
      );
    if (['about', 'delivery', 'payment', 'privacy'].includes(key))
      return (
        <div className="page-container section narrow-page">
          <span className="eyebrow">{settings.companyName}</span>
          <h1>{t(key as TranslationKey)}</h1>
          <div className="prose">
            {localized(settings[key as 'about' | 'delivery' | 'payment' | 'privacy'], lang)
              .split('\n')
              .map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
          </div>
          {key === 'delivery' && (
            <div className="delivery-note">
              <Truck size={24} />
              <p>{t('deliveryNote')}</p>
            </div>
          )}
        </div>
      );
    return (
      <div className="page-container section">
        <Empty
          title={t('notFound')}
          text={t('notFoundText')}
          action={t('home')}
          onAction={() => navigate('/')}
        />
      </div>
    );
  };
  return (
    <div className={`store-shell ${mobile ? 'native-app' : ''}`}>
      <div className="topbar">
        <div className="page-container">
          <span>
            <ShieldCheck size={13} />
            {t('accountFree')}
          </span>
          <div>
            <a {...link('/delivery')}>{t('delivery')}</a>
            <a {...link('/contact')}>{t('contact')}</a>
            <select
              aria-label={t('language')}
              value={lang}
              onChange={(e) => setLang(e.target.value as Language)}
            >
              <option value="uz">UZ</option>
              <option value="ru">RU</option>
              <option value="en">EN</option>
            </select>
          </div>
        </div>
      </div>
      <header className="site-header">
        <div className="page-container header-main">
          <a className="brand-link" {...link('/')} aria-label={t('home')}>
            <Brand
              name={settings.companyName}
              logo={settings.logo ? client.image(settings.logo) : ''}
            />
          </a>
          <div className="category-menu-wrap">
            <button
              className={`button catalog-menu-button ${categoriesOpen ? 'active' : ''}`}
              onClick={() => setCategoriesOpen(!categoriesOpen)}
              aria-expanded={categoriesOpen}
            >
              <Menu size={19} />
              {t('catalog')}
              <ChevronDown size={15} />
            </button>
            {categoriesOpen && (
              <div className="mega-menu">
                {(['metal', 'construction'] as const).map((group) => (
                  <div key={group}>
                    <h3>{t(group)}</h3>
                    {categories
                      .filter((c) => c.group === group)
                      .map((c) => (
                        <a key={c.id} {...link('/catalog?category=' + c.id)}>
                          {localized(c.name, lang)}
                          <ChevronRight size={13} />
                        </a>
                      ))}
                  </div>
                ))}
              </div>
            )}
          </div>
          <form className="header-search search-field" onSubmit={searchSubmit}>
            <Search size={19} />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 180)}
              placeholder={t('search')}
              aria-label={t('search')}
            />
            <button type="submit" aria-label={t('searchAction')}>
              <ArrowRight size={19} />
            </button>
            {searchOpen && search.length >= 2 && (
              <div className="search-suggestions">
                {suggestions.length ? (
                  suggestions.map((p) => (
                    <a key={p.id} {...link('/product/' + p.id)}>
                      <img src={client.image(p.images[0])} alt="" width="48" height="40" />
                      <span>
                        {localized(p.name, lang)}
                        <small>{p.code}</small>
                      </span>
                      <strong>{money(effectivePrice(p), lang)}</strong>
                    </a>
                  ))
                ) : (
                  <p>{t('emptyProducts')}</p>
                )}
              </div>
            )}
          </form>
          <div className="header-actions">
            <button
              className="icon-button theme-toggle"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              aria-label={t('theme')}
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
            <a className="header-action" {...link('/favorites')} aria-label={t('favorites')}>
              <Heart size={21} />
              {favorites.length > 0 && <span className="action-count">{favorites.length}</span>}
              <small>{t('favorites')}</small>
            </a>
            <a
              className="header-action compare-header"
              {...link('/compare')}
              aria-label={t('compare')}
            >
              <Scale size={21} />
              {compare.length > 0 && <span className="action-count">{compare.length}</span>}
              <small>{t('compare')}</small>
            </a>
            <button
              className="header-action cart-button"
              onClick={() => setCartOpen(true)}
              aria-label={`${t('cart')} (${cartCount})`}
            >
              <ShoppingCart size={22} />
              <span className="action-count cart-count">{cartCount}</span>
              <small>{t('cart')}</small>
            </button>
            <button
              className="icon-button mobile-menu-toggle"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={t('menu')}
            >
              <Menu size={23} />
            </button>
          </div>
        </div>
        <nav className="header-nav page-container" aria-label={t('menu')}>
          <a {...link('/catalog')}>{t('allCategories')}</a>
          <a {...link('/catalog?availability=discount')} className="orange-text">
            {t('discounts')}
          </a>
          <a {...link('/about')}>{t('about')}</a>
          <a {...link('/delivery')}>{t('delivery')}</a>
          <a {...link('/orders')}>{t('orders')}</a>
          <a {...link('/install')}>
            <Smartphone size={14} />
            {t('install')}
          </a>
        </nav>
      </header>
      {menuOpen && (
        <div className="mobile-nav">
          <div className="mobile-nav-heading">
            <strong>{t('menu')}</strong>
            <button
              className="icon-button"
              onClick={() => setMenuOpen(false)}
              aria-label={t('close')}
            >
              <X />
            </button>
          </div>
          {(
            [
              'catalog',
              'favorites',
              'compare',
              'recent',
              'orders',
              'about',
              'contact',
              'delivery',
              'payment',
              'faq',
              'privacy',
              'install',
            ] as const
          ).map((key) => (
            <a key={key} {...link(key === 'catalog' ? '/catalog' : '/' + key)}>
              {t(key)}
              <ChevronRight size={17} />
            </a>
          ))}
        </div>
      )}
      {bootstrap.demo && (
        <div className="demo-notice">
          <span>DEMO</span>
          {t('demoNotice')}
        </div>
      )}
      <main>
        {route === '/' ? (
          renderHome()
        ) : route === '/catalog' ? (
          <CatalogView
            key={path}
            bootstrap={bootstrap}
            apiBase={apiBase}
            initialSearch={params.get('q') || ''}
            initialCategory={params.get('category') || ''}
            initialSort={params.get('sort') || 'newest'}
            initialAvailability={params.get('availability') || ''}
            lang={lang}
            t={t}
            renderProduct={renderProduct}
          />
        ) : productId ? (
          <ProductDetail
            id={productId}
            apiBase={apiBase}
            websiteOrigin={bootstrap.settings.websiteUrl}
            lang={lang}
            t={t}
            image={client.image}
            onAdd={addCart}
            onBack={() => navigate('/catalog')}
            onOpen={(id) => navigate('/product/' + id)}
            onFavorite={toggleFavorite}
            onCompare={toggleCompare}
            notify={notify}
          />
        ) : route === '/checkout' ? (
          <div className="page-container section checkout-page">
            <button className="text-button back-link" onClick={() => setCartOpen(true)}>
              {t('cart')}
            </button>
            <h1>{confirmation ? t('orderSaved') : t('checkout')}</h1>
            {confirmation ? (
              <div className="confirmation-card">
                <CheckCircle2 size={55} />
                <h2>{t('successTitle')}</h2>
                <p>{t('successText')}</p>
                <span>{t('orderNumber')}</span>
                <strong>{confirmation.order.number}</strong>
                <b>{money(confirmation.order.total, lang)}</b>
                <p className="muted">{t('saveReceipt')}</p>
                <div className="confirmation-actions">
                  <button
                    className="button primary"
                    onClick={() => {
                      setConfirmation(null);
                      navigate('/catalog');
                    }}
                  >
                    {t('continueShopping')}
                    <ArrowRight size={17} />
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => {
                      setConfirmation(null);
                      navigate('/orders');
                    }}
                  >
                    {t('orders')}
                  </button>
                </div>
              </div>
            ) : !cart.length ? (
              <Empty
                title={t('emptyCart')}
                text={t('emptyCartText')}
                action={t('viewCatalog')}
                onAction={() => navigate('/catalog')}
              />
            ) : (
              <div className="checkout-layout">
                <form className="checkout-form" onSubmit={submitOrder}>
                  <div className="form-section-label">
                    <span>01</span>
                    <h2>{t('contact')}</h2>
                  </div>
                  <p className="muted">{t('checkoutNote')}</p>
                  <label>
                    {t('fullName')}
                    <input
                      value={checkoutName}
                      onChange={(e) => {
                        requestId.current = '';
                        setCheckoutName(e.target.value);
                      }}
                      placeholder={t('namePlaceholder')}
                      autoComplete="name"
                      required
                      minLength={5}
                      maxLength={100}
                    />
                  </label>
                  <label>
                    {t('phone')}
                    <input
                      value={checkoutPhone}
                      onChange={(e) => {
                        requestId.current = '';
                        setCheckoutPhone(formatPhone(e.target.value));
                      }}
                      placeholder="+998 __ ___ __ __"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      required
                      maxLength={17}
                    />
                  </label>
                  {checkoutError && (
                    <div className="form-error" role="alert">
                      {checkoutError}
                    </div>
                  )}
                  <div className="privacy-note">
                    <ShieldCheck size={18} />
                    <span>
                      {t('privacyCheckout')} <a {...link('/privacy')}>{t('privacy')}</a>
                    </span>
                  </div>
                  <button
                    className="button primary large full-width"
                    disabled={checkoutBusy || quoteLoading || !quote}
                  >
                    {checkoutBusy ? t('submitting') : t('submitOrder')}
                    <ArrowRight size={18} />
                  </button>
                </form>
                <OrderSummary
                  quote={quote}
                  loading={quoteLoading}
                  error={quoteError}
                  lang={lang}
                  t={t}
                  image={client.image}
                />
              </div>
            )}
          </div>
        ) : (
          renderInfo()
        )}
      </main>
      <footer className="site-footer">
        <div className="page-container footer-grid">
          <div>
            <a {...link('/')}>
              <Brand name={settings.companyName} />
            </a>
            <p>{t('heroText')}</p>
            <span className="footer-badge">
              <ShieldCheck size={16} />
              {t('accountFree')}
            </span>
          </div>
          <div>
            <h3>{t('catalog')}</h3>
            <a {...link('/catalog')}>{t('allCategories')}</a>
            <a {...link('/favorites')}>{t('favorites')}</a>
            <a {...link('/compare')}>{t('compare')}</a>
            <a {...link('/orders')}>{t('orders')}</a>
          </div>
          <div>
            <h3>{settings.companyName}</h3>
            {(['about', 'contact', 'delivery', 'payment'] as const).map((key) => (
              <a key={key} {...link('/' + key)}>
                {t(key)}
              </a>
            ))}
          </div>
          <div>
            <h3>{t('contact')}</h3>
            {settings.phones.length ? (
              settings.phones.map((phone) => (
                <a key={phone} href={'tel:' + phone}>
                  <Phone size={15} />
                  {phone}
                </a>
              ))
            ) : (
              <p>{t('notProvided')}</p>
            )}
            <a {...link('/faq')}>{t('faq')}</a>
            <a {...link('/privacy')}>{t('privacy')}</a>
            <a {...link('/install')}>
              <Smartphone size={15} />
              {t('install')}
            </a>
          </div>
        </div>
        <div className="page-container footer-bottom">
          <span>
            © {new Date().getFullYear()} {settings.companyName}. {t('copyright')}
          </span>
          <span>METAL · CONSTRUCTION · INDUSTRY</span>
        </div>
      </footer>
      <nav className="mobile-bottom-nav" aria-label={t('menu')}>
        <a {...link('/')} className={route === '/' ? 'active' : ''}>
          <Layers3 size={21} />
          <span>{t('home')}</span>
        </a>
        <a {...link('/catalog')} className={route === '/catalog' ? 'active' : ''}>
          <Search size={21} />
          <span>{t('catalog')}</span>
        </a>
        <button onClick={() => setCartOpen(true)}>
          <ShoppingCart size={21} />
          <span>
            {t('cart')} {cartCount > 0 && `(${cartCount})`}
          </span>
        </button>
        <a {...link('/favorites')}>
          <Heart size={21} />
          <span>{t('favorites')}</span>
        </a>
        <button onClick={() => setMenuOpen(true)}>
          <Menu size={21} />
          <span>{t('menu')}</span>
        </button>
      </nav>
      {settings.phones[0] && (
        <a className="floating-call" href={'tel:' + settings.phones[0]} aria-label={t('call')}>
          <Phone size={22} />
        </a>
      )}
      {cartOpen && (
        <Modal title={`${t('cart')} · ${cartCount}`} onClose={() => setCartOpen(false)}>
          <div className="cart-content">
            {!cart.length ? (
              <Empty
                title={t('emptyCart')}
                text={t('emptyCartText')}
                action={t('viewCatalog')}
                onAction={() => navigate('/catalog')}
              />
            ) : (
              <>
                <div className="cart-lines">
                  {cart.map((line) => {
                    const product = savedProducts.find((p) => p.id === line.productId);
                    const quoted = quote?.items.find((i) => i.productId === line.productId);
                    return (
                      <div className="cart-line" key={line.productId}>
                        <img
                          src={client.image(
                            quoted?.image ||
                              product?.images[0] ||
                              '/images/products/steel-pipes.webp',
                          )}
                          alt=""
                          width="84"
                          height="72"
                        />
                        <div className="cart-line-info">
                          <strong>
                            {quoted?.name ||
                              (product ? localized(product.name, lang) : line.productId)}
                          </strong>
                          <span>
                            {money(quoted?.unitPrice || 0, lang)} /{' '}
                            {unitLabel(quoted?.unit || product?.unit || 'kg', lang)}
                          </span>
                          <div className="quantity-control small">
                            <button
                              aria-label={t('previous')}
                              disabled={
                                quoteLoading ||
                                line.quantity <= (product?.minOrder || quoted?.quantity || 1)
                              }
                              onClick={() => {
                                const next = Number(
                                  (line.quantity - (product?.step || 1)).toFixed(6),
                                );
                                setCart((items) =>
                                  items.map((x) =>
                                    x.productId === line.productId
                                      ? { ...x, quantity: Math.max(product?.minOrder || 1, next) }
                                      : x,
                                  ),
                                );
                              }}
                            >
                              <Minus size={14} />
                            </button>
                            <span>{groupNumber(line.quantity)}</span>
                            <button
                              aria-label={t('next')}
                              disabled={
                                quoteLoading ||
                                !product ||
                                line.quantity + product.step > product.stock
                              }
                              onClick={() =>
                                setCart((items) =>
                                  items.map((x) =>
                                    x.productId === line.productId
                                      ? {
                                          ...x,
                                          quantity: Number(
                                            (x.quantity + (product?.step || 1)).toFixed(6),
                                          ),
                                        }
                                      : x,
                                  ),
                                )
                              }
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </div>
                        <div className="cart-line-end">
                          <button
                            className="icon-button"
                            onClick={() =>
                              setCart((items) =>
                                items.filter((x) => x.productId !== line.productId),
                              )
                            }
                            aria-label={t('remove')}
                          >
                            <Trash2 size={17} />
                          </button>
                          <strong>{money(quoted?.total || 0, lang)}</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <form
                  className="coupon-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    applyCoupon(couponInput.trim().toUpperCase());
                  }}
                >
                  <input
                    placeholder={t('coupon')}
                    aria-label={t('coupon')}
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    maxLength={40}
                  />
                  <button className="button secondary" disabled={quoteLoading}>
                    {t('apply')}
                  </button>
                  {coupon && (
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => {
                        applyCoupon('');
                        setCouponInput('');
                      }}
                      aria-label={t('remove')}
                    >
                      <X size={17} />
                    </button>
                  )}
                </form>
                {quoteError && (
                  <div className="form-error" role="alert">
                    {quoteError}
                  </div>
                )}
                {quote?.couponCode && (
                  <div className="success-note">
                    <Check size={16} />
                    {t('couponApplied')}
                  </div>
                )}
                <div className="cart-total">
                  <span>{t('total')}</span>
                  <strong>{quoteLoading ? t('loading') : money(quote?.total || 0, lang)}</strong>
                </div>
                <p className="muted small-text">{t('deliveryNote')}</p>
                <button
                  className="button primary large full-width"
                  disabled={!quote || quoteLoading}
                  onClick={() => {
                    setConfirmation(null);
                    navigate('/checkout');
                  }}
                >
                  {t('orderNow')}
                  <ArrowRight size={18} />
                </button>
                <button
                  className="text-button clear-cart"
                  onClick={() => {
                    setCart([]);
                    applyCoupon('');
                    setCouponInput('');
                  }}
                >
                  {t('clearCart')}
                </button>
              </>
            )}
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
    </div>
  );
}
function OrderSummary({
  quote,
  loading,
  error,
  lang,
  t,
  image,
}: {
  quote: Quote | null;
  loading: boolean;
  error: string;
  lang: Language;
  t: (key: TranslationKey) => string;
  image: (url: string) => string;
}) {
  return (
    <aside className="order-summary">
      <h2>{t('cart')}</h2>
      {loading ? (
        <Loading label={t('loading')} />
      ) : error ? (
        <p className="form-error">{error}</p>
      ) : (
        quote && (
          <>
            <div className="summary-lines">
              {quote.items.map((item) => (
                <div key={item.productId}>
                  <img src={image(item.image)} alt="" width="54" height="48" />
                  <span>
                    {item.name}
                    <small>
                      {groupNumber(item.quantity)} {unitLabel(item.unit, lang)}
                    </small>
                  </span>
                  <strong>{money(item.total, lang)}</strong>
                </div>
              ))}
            </div>
            <div className="summary-row">
              <span>{t('subtotal')}</span>
              <b>{money(quote.subtotal, lang)}</b>
            </div>
            {quote.discount > 0 && (
              <div className="summary-row orange-text">
                <span>{t('discount')}</span>
                <b>−{money(quote.discount, lang)}</b>
              </div>
            )}
            <div className="summary-row grand-total">
              <span>{t('total')}</span>
              <strong>{money(quote.total, lang)}</strong>
            </div>
            <p className="muted small-text">{t('deliveryNote')}</p>
          </>
        )
      )}
    </aside>
  );
}
function SupportForm({
  client,
  t,
}: {
  client: ReturnType<typeof createClient>;
  t: (key: TranslationKey) => string;
}) {
  const [name, setName] = useState(''),
    [phone, setPhone] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [success, setSuccess] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await client.post('/support', { name, phone, message });
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setBusy(false);
    }
  };
  return success ? (
    <div className="support-success">
      <CheckCircle2 size={40} />
      <h2>{t('supportSuccess')}</h2>
    </div>
  ) : (
    <form className="support-form" onSubmit={submit}>
      <h2>{t('support')}</h2>
      <label>
        {t('fullName')}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={5}
          maxLength={100}
          autoComplete="name"
        />
      </label>
      <label>
        {t('phone')}
        <input
          value={phone}
          onChange={(e) => setPhone(formatPhone(e.target.value))}
          placeholder="+998 __ ___ __ __"
          type="tel"
          autoComplete="tel"
          required
        />
      </label>
      <label>
        {t('message')}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={5}
          maxLength={2000}
          rows={5}
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button primary" disabled={busy}>
        {busy ? t('submitting') : t('send')}
        <ArrowRight size={17} />
      </button>
    </form>
  );
}
function ReceiptCard({
  receipt,
  client,
  lang,
  t,
}: {
  receipt: Receipt;
  client: ReturnType<typeof createClient>;
  lang: Language;
  t: (key: TranslationKey) => string;
}) {
  const [order, setOrder] = useState<Order | null>(null),
    [error, setError] = useState('');
  const load = () =>
    client
      .request<Order>('/orders/' + receipt.id, { headers: { 'X-Order-Token': receipt.token } })
      .then(setOrder)
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, [receipt.id]);
  return (
    <article className="receipt-card">
      <div>
        <span className="eyebrow">{t('orderNumber')}</span>
        <h3>{receipt.number}</h3>
        {order && <time>{formatDate(order.createdAt, lang)}</time>}
      </div>
      {error ? (
        <button className="button secondary" onClick={load}>
          {t('retry')}
        </button>
      ) : !order ? (
        <Loading label={t('loading')} />
      ) : (
        <>
          <span className="status-badge">{order.status}</span>
          <strong>{money(order.total, lang)}</strong>
          <details>
            <summary>
              {t('viewDetails')}
              <ChevronDown size={16} />
            </summary>
            <ul>
              {order.items.map((item) => (
                <li key={item.productId}>
                  {item.name} · {groupNumber(item.quantity)} {unitLabel(item.unit, lang)} ·{' '}
                  {money(item.total, lang)}
                </li>
              ))}
            </ul>
            <h4>{t('orderHistory')}</h4>
            <ol>
              {order.history.map((h, i) => (
                <li key={i}>
                  {h.status} · {formatDate(h.at, lang)}
                </li>
              ))}
            </ol>
          </details>
        </>
      )}
    </article>
  );
}

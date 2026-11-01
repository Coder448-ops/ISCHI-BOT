'use client';

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import Image from 'next/image';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  CircleCheck,
  Headphones,
  LoaderCircle,
  Menu,
  Minus,
  Package,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import type { Product } from '@/lib/catalog';
import { categories } from '@/lib/catalog';
import {
  formatPhone,
  money,
  shortMoney,
  normalizePhone,
  type CartItem,
  type Order,
} from '@/lib/format';
import { validName, validPhone } from '@/lib/validation';
import Dialog from './dialog';

const CART_KEY = 'ischi-cart-v1';
function Logo({ light = false }: { light?: boolean }) {
  return (
    <a className={`logo ${light ? 'logo-light' : ''}`} href="#top" aria-label="ISCHI bosh sahifa">
      <span className="logo-symbol">
        <ShoppingBag size={22} strokeWidth={1.8} />
      </span>
      <span>
        ishchi<span className="logo-dot">.</span>
      </span>
    </a>
  );
}
function Quantity({
  value,
  onChange,
  name,
  max = 20,
}: {
  value: number;
  onChange: (n: number) => void;
  name: string;
  max?: number;
}) {
  return (
    <div className="quantity">
      <button
        type="button"
        aria-label={`${name}: kamaytirish`}
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
      >
        <Minus size={14} />
      </button>
      <span aria-live="polite">{value}</span>
      <button
        type="button"
        aria-label={`${name}: ko‘paytirish`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

export default function Storefront({ products }: { products: Product[] }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [category, setCategory] = useState('Barchasi');
  const [query, setQuery] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [step, setStep] = useState<'cart' | 'checkout' | 'success'>('cart');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<{ name?: string; phone?: string; general?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const requestId = useRef<string | null>(null);
  const [confirmation, setConfirmation] = useState<Order | null>(null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const phoneSelection = useRef<number | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    if (
      phoneSelection.current !== null &&
      phoneRef.current &&
      document.activeElement === phoneRef.current
    ) {
      phoneRef.current.setSelectionRange(phoneSelection.current, phoneSelection.current);
      phoneSelection.current = null;
    }
  }, [phone]);
  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      if (Array.isArray(stored)) {
        const valid = stored.filter(
          (i): i is CartItem =>
            i &&
            typeof i.productId === 'string' &&
            products.some((p) => p.id === i.productId) &&
            Number.isInteger(i.quantity) &&
            i.quantity >= 1 &&
            i.quantity <= 20,
        );
        setCart(Array.from(new Map(valid.map((i) => [i.productId, i])).values()));
      }
    } catch {
      /* A blocked or corrupt local store must not prevent shopping. */
    }
    setHydrated(true);
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [products]);
  useEffect(() => {
    if (hydrated)
      try {
        localStorage.setItem(CART_KEY, JSON.stringify(cart));
      } catch {
        /* Shopping still works in memory. */
      }
  }, [cart, hydrated]);
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartProducts = cart.flatMap((item) => {
    const product = products.find((p) => p.id === item.productId);
    return product ? [{ ...product, quantity: item.quantity }] : [];
  });
  const total = cartProducts.reduce((sum, p) => sum + p.price * p.quantity, 0);
  const visible = products.filter(
    (p) =>
      (category === 'Barchasi' || p.category === category) &&
      `${p.name} ${p.category} ${p.specification}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase().trim()),
  );
  function notify(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3200);
  }
  function add(product: Product) {
    const existing = cart.find((i) => i.productId === product.id);
    if (existing && existing.quantity >= 20) {
      notify('Bitta mahsulotdan ko‘pi bilan 20 ta tanlash mumkin.');
      return;
    }
    setCart((items) =>
      existing
        ? items.map((i) => (i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i))
        : [...items, { productId: product.id, quantity: 1 }],
    );
    notify(`${product.name} savatga qo‘shildi`);
  }
  function setQuantity(id: string, quantity: number) {
    setCart((items) =>
      items.map((i) =>
        i.productId === id ? { ...i, quantity: Math.max(1, Math.min(20, quantity)) } : i,
      ),
    );
  }
  function openCart() {
    setCartOpen(true);
    setStep('cart');
    setErrors({});
    setMobileMenu(false);
  }
  function checkout() {
    setStep('checkout');
    setErrors({});
  }
  function continueShopping() {
    setCartOpen(false);
    setConfirmation(null);
    setStep('cart');
  }
  function changePhone(value: string, caret: number) {
    const digitsBefore = value.slice(0, caret).replace(/\D/g, '').replace(/^998/, '').length;
    const formatted = formatPhone(value);
    let pos = 0,
      digits = -3; // Skip the fixed +998 country-code digits.
    while (pos < formatted.length && digits < digitsBefore) {
      if (/\d/.test(formatted[pos])) digits++;
      pos++;
    }
    if (digitsBefore === 0) pos = formatted.length;
    phoneSelection.current = pos;
    setPhone(formatted);
    if (formatted === phone && phoneRef.current) {
      phoneRef.current.value = formatted;
      phoneRef.current.setSelectionRange(pos, pos);
      phoneSelection.current = null;
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submittingRef.current) return;
    const nextErrors: typeof errors = {};
    if (!validName(name)) nextErrors.name = 'Ism va familiyangizni to‘liq kiriting.';
    if (!validPhone(phone))
      nextErrors.phone = 'Telefon raqamini to‘liq kiriting: +998 XX XXX XX XX.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      (nextErrors.name ? nameRef : phoneRef).current?.focus();
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    requestId.current ??= crypto.randomUUID();
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: name.trim(),
          phone: normalizePhone(phone),
          items: cart,
          requestId: requestId.current,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status < 500) requestId.current = null;
        throw new Error(data.error || 'Buyurtmani yuborib bo‘lmadi. Qayta urinib ko‘ring.');
      }
      setConfirmation(data.order);
      setCart([]);
      setStep('success');
      setName('');
      setPhone('');
      requestId.current = null;
    } catch (error) {
      setErrors({
        general:
          error instanceof TypeError
            ? 'Internet aloqasini tekshiring. Buyurtmangizni qayta yuborishingiz mumkin.'
            : error instanceof Error
              ? error.message
              : 'Xatolik yuz berdi. Qayta urinib ko‘ring.',
      });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }
  return (
    <div id="top">
      <a className="skip-link" href="#mahsulotlar">
        Mahsulotlarga o‘tish
      </a>
      <div className="announcement">
        <div className="container announcement-inner">
          <span>
            <Sparkles size={13} /> Kichik qadamlar. Katta imkoniyatlar.
          </span>
          <span className="announcement-right">
            Ro‘yxatdan o‘tish shart emas <ArrowUpRight size={13} />
          </span>
        </div>
      </div>
      <header className="site-header" inert={cartOpen}>
        <div className="container header-inner">
          <Logo />
          <nav className={mobileMenu ? 'main-nav is-open' : 'main-nav'} aria-label="Asosiy menyu">
            <a href="#mahsulotlar" onClick={() => setMobileMenu(false)}>
              Mahsulotlar
            </a>
            <a href="#qanday-ishlaydi" onClick={() => setMobileMenu(false)}>
              Qanday ishlaydi
            </a>
            <a href="#afzalliklar" onClick={() => setMobileMenu(false)}>
              Nega aynan biz?
            </a>
          </nav>
          <div className="header-actions">
            <button className="cart-button" onClick={openCart}>
              <ShoppingBag size={18} />
              <span>Savat</span>
              <span className="cart-count" aria-label={`${count} ta mahsulot`}>
                {count}
              </span>
            </button>
            <button
              className="icon-button mobile-menu-button"
              aria-label="Menyuni ochish"
              aria-expanded={mobileMenu}
              onClick={() => setMobileMenu(!mobileMenu)}
            >
              {mobileMenu ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>
      <main inert={cartOpen}>
        <section className="hero container" aria-labelledby="hero-title">
          <div className="hero-image">
            <Image
              src="/images/hero.webp"
              alt="Yorug‘ yashil fonda zamonaviy titan smartfon"
              fill
              priority
              sizes="(max-width: 700px) 100vw, 65vw"
            />
          </div>
          <div className="hero-content">
            <div className="eyebrow">
              <span className="tiny-line" /> TEXNIKA. OSAN TANLOV.
            </div>
            <h1 id="hero-title">
              Yaxshi texnika.
              <br />
              <span>Yanada oson xarid.</span>
            </h1>
            <p>
              Sevimli texnikangizni tanlang. Hisob yaratmasdan,
              <br className="desktop-break" /> bir necha qadamda buyurtma bering.
            </p>
            <a href="#mahsulotlar" className="button button-primary hero-cta">
              Mahsulotlarni ko‘rish <ArrowUpRight size={19} />
            </a>
            <div className="hero-note">
              <ShieldCheck size={16} />
              <span>Faqat ism va telefon raqamingiz yetarli</span>
            </div>
          </div>
          <div className="hero-product-tag">
            <span className="tag-icon">
              <Sparkles size={18} />
            </span>
            <div>
              <span>Yangi avlod. Yangi imkoniyat.</span>
              <strong>iPhone 16 Pro</strong>
            </div>
            <a href="#iphone-16-pro" aria-label="iPhone 16 Pro mahsulotini ko‘rish">
              <ArrowUpRight size={20} />
            </a>
          </div>
          <span className="hero-index">
            01 <span>/ 01</span>
          </span>
        </section>
        <section
          id="afzalliklar"
          className="container benefits"
          aria-label="Xarid qilish afzalliklari"
        >
          <div>
            <span className="benefit-icon">
              <UserRound size={22} />
            </span>
            <div>
              <h3>Hisobsiz, bemalol</h3>
              <p>Ro‘yxatdan o‘tishga hojat yo‘q</p>
            </div>
          </div>
          <div>
            <span className="benefit-icon">
              <Phone size={22} />
            </span>
            <div>
              <h3>Jonli muloqot</h3>
              <p>Buyurtmani operator tasdiqlaydi</p>
            </div>
          </div>
          <div>
            <span className="benefit-icon">
              <ShoppingBag size={22} />
            </span>
            <div>
              <h3>Xarid oson bo‘lsin</h3>
              <p>Tanlang, qoldiring — tamom</p>
            </div>
          </div>
        </section>
        <section
          id="mahsulotlar"
          className="container catalog-section"
          aria-labelledby="catalog-title"
        >
          <div className="section-heading">
            <div>
              <div className="eyebrow">SIZ UCHUN TANLANGAN</div>
              <h2 id="catalog-title">
                O‘zingizga mosini toping<span className="orange-dot">.</span>
              </h2>
            </div>
            <span className="catalog-count">
              {products.length} ta mahsulot <ArrowDown size={15} />
            </span>
          </div>
          <div className="catalog-toolbar">
            <div className="category-tabs" role="group" aria-label="Mahsulot toifasi">
              {categories.map((c) => (
                <button
                  key={c}
                  className={category === c ? 'active' : ''}
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <label className="search-field">
              <Search size={17} />
              <input
                aria-label="Mahsulot qidirish"
                placeholder="Mahsulot qidirish..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button aria-label="Qidiruvni tozalash" onClick={() => setQuery('')}>
                  <X size={14} />
                </button>
              )}
            </label>
          </div>
          <div className="product-grid">
            {visible.map((product, index) => {
              const item = cart.find((i) => i.productId === product.id);
              return (
                <article
                  className="product-card"
                  id={product.id}
                  key={product.id}
                  style={{ animationDelay: `${index * 65}ms` }}
                >
                  <div className="product-image">
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      sizes="(max-width: 540px) 90vw, (max-width: 900px) 45vw, 25vw"
                    />
                    {product.badge && (
                      <span
                        className={`product-badge ${product.badge === 'Yangi' ? 'badge-new' : ''}`}
                      >
                        {product.badge === 'Yangi' && <span />}
                        {product.badge}
                      </span>
                    )}
                    <span className="product-color">
                      <span
                        style={{
                          background: product.id.includes('iphone')
                            ? '#b8afa0'
                            : product.id.includes('macbook')
                              ? '#34434e'
                              : product.id.includes('watch')
                                ? '#b4c4ad'
                                : '#fff',
                        }}
                      />
                      {product.color}
                    </span>
                  </div>
                  <div className="product-info">
                    <span className="product-category">{product.category}</span>
                    <h3>{product.name}</h3>
                    <p className="product-spec">{product.specification}</p>
                    <div className="product-bottom">
                      <div className="product-price">
                        {shortMoney(product.price)}
                        <span>so‘m</span>
                      </div>
                      {item ? (
                        <Quantity
                          value={item.quantity}
                          name={product.name}
                          onChange={(n) => setQuantity(product.id, n)}
                        />
                      ) : (
                        <button
                          className="add-button"
                          onClick={() => add(product)}
                          aria-label={`${product.name} savatga qo‘shish`}
                        >
                          <Plus size={18} />
                          <span>Savatga</span>
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          {!visible.length && (
            <div className="empty-state">
              <Search size={34} />
              <h3>Mahsulot topilmadi</h3>
              <p>Boshqa nom bilan qidirib ko‘ring yoki barcha mahsulotlarni ko‘ring.</p>
              <button
                className="button button-secondary"
                onClick={() => {
                  setQuery('');
                  setCategory('Barchasi');
                }}
              >
                Barcha mahsulotlar
              </button>
            </div>
          )}
          <p className="catalog-note">
            <Package size={14} /> Narxlar so‘mda ko‘rsatilgan. Yetkazib berish shartlarini operator
            tasdiqlaydi.
          </p>
        </section>
        <section id="qanday-ishlaydi" className="container how-section" aria-labelledby="how-title">
          <div className="how-intro">
            <div className="eyebrow">HAMMASI JUDA OSON</div>
            <h2 id="how-title">
              Uch qadam.
              <br />
              Ortiqcha ovora yo‘q.
            </h2>
            <a href="#mahsulotlar">
              Birinchi qadamdan boshlang <ArrowUpRight size={18} />
            </a>
          </div>
          <div className="how-steps">
            <div>
              <span className="step-number">01</span>
              <span className="step-icon">
                <ShoppingBag size={23} />
              </span>
              <h3>Yoqqanini tanlang</h3>
              <p>Mahsulotlarni savatga qo‘shing va buyurtma tugmasini bosing.</p>
            </div>
            <div>
              <span className="step-number">02</span>
              <span className="step-icon">
                <UserRound size={23} />
              </span>
              <h3>Ikki ma’lumot — xolos</h3>
              <p>Ism, familiya va telefon raqamingizni qoldiring. Hisob kerak emas.</p>
            </div>
            <div>
              <span className="step-number">03</span>
              <span className="step-icon">
                <Headphones size={23} />
              </span>
              <h3>Biz bog‘lanamiz</h3>
              <p>Operator qo‘ng‘iroq qilib, buyurtma tafsilotlarini tasdiqlaydi.</p>
            </div>
          </div>
        </section>
        <section className="container closing-banner">
          <div>
            <span className="closing-spark">
              <Sparkles size={28} />
            </span>
            <h2>
              Yangi texnika bilan
              <br />
              yangi imkoniyatlarga tayyormisiz?
            </h2>
          </div>
          <a href="#mahsulotlar" className="button button-light">
            O‘zingiznikini tanlang <ArrowUpRight size={19} />
          </a>
        </section>
      </main>
      <footer className="site-footer container" inert={cartOpen}>
        <div className="footer-top">
          <Logo />
          <p>
            Kundalik hayotingizga mos texnika.
            <br />
            Tanlash esa endi osonroq.
          </p>
          <a href="#mahsulotlar">
            Mahsulotlar <ArrowUpRight size={15} />
          </a>
          <a href="#qanday-ishlaydi">
            Qanday ishlaydi <ArrowUpRight size={15} />
          </a>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} ISCHI. Barcha huquqlar himoyalangan.</span>
          <span className="demo-note">Namoyish katalogi · Mahsulot va narxlar namunaviy</span>
          <a href="/admin">
            Administrator <ArrowUpRight size={13} />
          </a>
        </div>
      </footer>
      {toast && !cartOpen && (
        <div className="toast" role="status">
          <CircleCheck size={19} />
          <span>{toast}</span>
          <button onClick={openCart}>
            Savatni ko‘rish <ArrowRight size={15} />
          </button>
          <button className="toast-close" aria-label="Xabarni yopish" onClick={() => setToast('')}>
            <X size={16} />
          </button>
        </div>
      )}
      {cartOpen && (
        <Dialog
          onClose={() => setCartOpen(false)}
          titleId="cart-title"
          className="cart-drawer"
          closeDisabled={submitting}
        >
          <div className="drawer-header">
            <div>
              <span className="eyebrow">SIZNING TANLOVINGIZ</span>
              <h2 id="cart-title">
                {step === 'success'
                  ? 'Buyurtma qabul qilindi'
                  : step === 'checkout'
                    ? 'Buyurtmani rasmiylashtirish'
                    : 'Savatingiz'}
                {step === 'cart' && <span className="title-count">{count}</span>}
              </h2>
            </div>
            <button
              className="icon-button"
              aria-label="Savatni yopish"
              disabled={submitting}
              onClick={() => setCartOpen(false)}
            >
              <X size={22} />
            </button>
          </div>
          {step === 'cart' &&
            (cartProducts.length ? (
              <>
                <div className="drawer-body cart-items">
                  <div className="guest-note">
                    <ShieldCheck size={17} /> Hisob yaratmasdan buyurtma berishingiz mumkin.
                  </div>
                  {cartProducts.map((p) => (
                    <div className="cart-item" key={p.id}>
                      <div className="cart-item-image">
                        <Image src={p.image} alt={p.name} fill sizes="88px" />
                      </div>
                      <div className="cart-item-info">
                        <h3>{p.name}</h3>
                        <p>{p.specification}</p>
                        <strong>{money(p.price * p.quantity)}</strong>
                        <Quantity
                          value={p.quantity}
                          name={p.name}
                          onChange={(n) => setQuantity(p.id, n)}
                        />
                      </div>
                      <button
                        className="icon-button remove-item"
                        aria-label={`${p.name} savatdan olib tashlash`}
                        onClick={() =>
                          setCart((items) => items.filter((i) => i.productId !== p.id))
                        }
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="drawer-summary">
                  <div className="summary-row">
                    <span>Mahsulotlar ({count} ta)</span>
                    <span>{money(total)}</span>
                  </div>
                  <p className="muted small">
                    Yetkazib berish shartlari operator bilan kelishiladi.
                  </p>
                  <div className="summary-row summary-total">
                    <span>Jami</span>
                    <strong>{money(total)}</strong>
                  </div>
                  <button className="button button-primary full-width" onClick={checkout}>
                    Buyurtma berish <ArrowRight size={19} />
                  </button>
                  <button className="text-button full-width" onClick={continueShopping}>
                    Xaridni davom ettirish
                  </button>
                </div>
              </>
            ) : (
              <div className="empty-state cart-empty">
                <span className="empty-icon">
                  <ShoppingBag size={36} />
                </span>
                <h3>Savatingiz hozircha bo‘sh</h3>
                <p>
                  Yoqqan mahsulotni toping.
                  <br />
                  Qolgan hammasi juda oson.
                </p>
                <button className="button button-primary" onClick={continueShopping}>
                  Mahsulotlarni ko‘rish <ArrowUpRight size={18} />
                </button>
              </div>
            ))}
          {step === 'checkout' && (
            <form className="checkout-form" onSubmit={submit} noValidate>
              <div className="drawer-body">
                <button
                  type="button"
                  className="text-button back-button"
                  disabled={submitting}
                  onClick={() => setStep('cart')}
                >
                  <ArrowLeft size={16} /> Savatga qaytish
                </button>
                <div className="checkout-intro">
                  <h3>Tanishingamiz!</h3>
                  <p>
                    Faqat ism va telefon raqamingiz yetarli.
                    <br />
                    Qolganini biz hal qilamiz.
                  </p>
                </div>
                <div className="form-field">
                  <label htmlFor="customer-name">
                    Ism va familiya <span>*</span>
                  </label>
                  <div className={`input-wrap ${errors.name ? 'invalid' : ''}`}>
                    <UserRound size={18} />
                    <input
                      ref={nameRef}
                      id="customer-name"
                      name="name"
                      autoComplete="name"
                      placeholder="Masalan: Ali Valiyev"
                      required
                      maxLength={100}
                      value={name}
                      disabled={submitting}
                      aria-invalid={Boolean(errors.name)}
                      aria-describedby={errors.name ? 'name-error' : undefined}
                      onChange={(e) => {
                        setName(e.target.value);
                        setErrors((v) => ({ ...v, name: undefined }));
                      }}
                    />
                  </div>
                  {errors.name && (
                    <p id="name-error" className="field-error" role="alert">
                      {errors.name}
                    </p>
                  )}
                </div>
                <div className="form-field">
                  <label htmlFor="customer-phone">
                    Telefon raqami <span>*</span>
                  </label>
                  <div className={`input-wrap ${errors.phone ? 'invalid' : ''}`}>
                    <Phone size={18} />
                    <input
                      ref={phoneRef}
                      id="customer-phone"
                      name="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel-national"
                      placeholder="+998 __ ___ __ __"
                      required
                      maxLength={25}
                      value={phone}
                      disabled={submitting}
                      aria-invalid={Boolean(errors.phone)}
                      aria-describedby={errors.phone ? 'phone-error' : 'phone-hint'}
                      onChange={(e) => {
                        changePhone(e.target.value, e.target.selectionStart || 0);
                        setErrors((v) => ({ ...v, phone: undefined }));
                      }}
                      onFocus={() => {
                        if (!phone) setPhone('+998 ');
                      }}
                    />
                  </div>
                  {errors.phone ? (
                    <p id="phone-error" className="field-error" role="alert">
                      {errors.phone}
                    </p>
                  ) : (
                    <p id="phone-hint" className="field-hint">
                      Operator siz bilan shu raqam orqali bog‘lanadi.
                    </p>
                  )}
                </div>
                <div className="checkout-order">
                  <div className="checkout-order-title">
                    <Package size={17} />
                    <strong>Buyurtmangiz</strong>
                    <span>{count} ta</span>
                  </div>
                  {cartProducts.map((p) => (
                    <div className="checkout-product" key={p.id}>
                      <span>
                        {p.name} <small>× {p.quantity}</small>
                      </span>
                      <span>{shortMoney(p.price * p.quantity)}</span>
                    </div>
                  ))}
                  <div className="summary-row summary-total">
                    <span>Jami</span>
                    <strong>{money(total)}</strong>
                  </div>
                </div>
                <p className="privacy-note">
                  <ShieldCheck size={16} /> Ma’lumotlaringiz faqat buyurtmangizni rasmiylashtirish
                  uchun ishlatiladi.
                </p>
                {errors.general && (
                  <div className="error-banner" role="alert">
                    {errors.general}
                  </div>
                )}
              </div>
              <div className="drawer-summary">
                <button
                  className="button button-primary full-width"
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <LoaderCircle className="spin" size={19} /> Yuborilmoqda...
                    </>
                  ) : (
                    <>
                      Buyurtmani tasdiqlash <ArrowRight size={19} />
                    </>
                  )}
                </button>
                <p className="secure-note">
                  <Check size={14} /> Ro‘yxatdan o‘tishsiz. Tez va oson.
                </p>
              </div>
            </form>
          )}
          {step === 'success' && confirmation && (
            <div className="drawer-body success-content">
              <div className="success-mark">
                <CheckCheck size={38} />
              </div>
              <div className="eyebrow">HAMMASI TAYYOR</div>
              <h3>
                Buyurtmangiz
                <br />
                qabul qilindi!
              </h3>
              <p>
                Rahmat, {confirmation.customerName.split(' ')[0]}!<br />
                Tez orada operator siz bilan bog‘lanadi.
              </p>
              <div className="confirmation-card">
                <div>
                  <span>Buyurtma raqami</span>
                  <strong>{confirmation.number}</strong>
                </div>
                <div>
                  <span>Telefon raqamingiz</span>
                  <strong>{formatPhone(confirmation.phone)}</strong>
                </div>
                <div>
                  <span>Holati</span>
                  <span className="status-badge status-new">
                    <span />
                    Yangi
                  </span>
                </div>
                <div className="confirmation-total">
                  <span>Jami</span>
                  <strong>{money(confirmation.total)}</strong>
                </div>
              </div>
              <div className="success-next">
                <Phone size={20} />
                <p>
                  Telefoningizni yaqin tuting.
                  <br />
                  <span>Buyurtma tafsilotlarini birga tasdiqlaymiz.</span>
                </p>
              </div>
              <button className="button button-primary full-width" onClick={continueShopping}>
                Xaridni davom ettirish <ArrowRight size={18} />
              </button>
              <p className="small muted">Yana buyurtma berishingiz mumkin. Hisob kerak emas.</p>
            </div>
          )}
        </Dialog>
      )}
    </div>
  );
}

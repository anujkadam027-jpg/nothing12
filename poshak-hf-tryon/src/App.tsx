import { useCallback, useEffect, useMemo, useState } from 'react';
import { CatalogSection } from './components/CatalogSection';
import { CheckoutModal } from './components/CheckoutModal';
import { DeliveryLocationModal } from './components/DeliveryLocationModal';
import { FittingRoom } from './components/FittingRoom';
import { HeroSection, StorefrontBottomTitle } from './components/HeroSection';
import { Navbar } from './components/Navbar';
import { OrdersView } from './components/OrdersView';
import { ProductDetailView } from './components/ProductDetailView';
import { SavedLooksDrawer } from './components/SavedLooksDrawer';
import { GARMENTS } from './data/catalog';
import type {
  BodyParameters,
  CategoryId,
  DeliveryLocation,
  GarmentProduct,
  GarmentSize,
  OrderRecord,
  ProductReview,
  SavedLook,
  StoreRequest,
  TryOnMode,
} from './types/poshak';
import {
  addItemToCart,
  getCartTotalCount,
  removeCartItem,
  updateCartItemQuantity,
  type CartItem,
} from './utils/cartAndFitting';
import { PRESET_LOCATIONS } from './utils/commerce';
import { DEFAULT_BODY_PARAMS } from './utils/tryonMath';

export default function App() {
  const [activeView, setActiveView] = useState<
    'storefront' | 'product' | 'fitting-room' | 'orders'
  >('storefront');
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dealsOnly, setDealsOnly] = useState(false);
  const [deliveryLocation, setDeliveryLocation] = useState<DeliveryLocation>(PRESET_LOCATIONS[0]);

  const [activeProduct, setActiveProduct] = useState<GarmentProduct>(GARMENTS[0]);
  const [activeMode, setActiveMode] = useState<TryOnMode>('dummy');
  const [activeSize, setActiveSize] = useState<GarmentSize>('M');
  const [bodyParams, setBodyParams] = useState<BodyParameters>(DEFAULT_BODY_PARAMS);

  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [savedLooks, setSavedLooks] = useState<SavedLook[]>([]);
  const [bagItems, setBagItems] = useState<CartItem[]>([]);
  const [submittedRequests, setSubmittedRequests] = useState<StoreRequest[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [latestOrderId, setLatestOrderId] = useState<string | null>(null);
  const [userReviewsByProduct, setUserReviewsByProduct] = useState<
    Record<string, ProductReview[]>
  >({});

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'cart' | 'saved'>('cart');
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutItems, setCheckoutItems] = useState<CartItem[]>([]);
  const [checkoutSource, setCheckoutSource] = useState<'cart' | 'buy-now'>('cart');
  const [checkoutPromo, setCheckoutPromo] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetch('/api/orders'), fetch('/api/requests')])
      .then(async ([ordersRes, reqRes]) => {
        if (cancelled) return;
        if (ordersRes.ok) {
          const oData = (await ordersRes.json()) as { orders?: OrderRecord[] };
          if (Array.isArray(oData.orders)) setOrders(oData.orders);
        }
        if (reqRes.ok) {
          const rData = (await reqRes.json()) as { requests?: StoreRequest[] };
          if (Array.isArray(rData.requests)) setSubmittedRequests(rData.requests);
        }
      })
      .catch(() => {
        // Non-blocking initial hydrate
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const relatedProducts = useMemo(
    () =>
      GARMENTS.filter(
        (g) => g.category === activeProduct.category && g.id !== activeProduct.id
      ),
    [activeProduct]
  );

  const cartProductIds = useMemo(
    () => Array.from(new Set(bagItems.map((b) => b.product.id))),
    [bagItems]
  );

  const totalCartCount = useMemo(() => getCartTotalCount(bagItems), [bagItems]);

  const scrollToCatalog = () => {
    setActiveView('storefront');
    window.setTimeout(() => {
      document.getElementById('poshak-catalog')?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  const handleSelectCategoryFromNav = (catId: CategoryId | 'all') => {
    setSelectedCategory(catId);
    setDealsOnly(false);
    setActiveView('storefront');
    window.setTimeout(() => {
      document.getElementById('poshak-catalog')?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  const handleSearchSubmit = () => {
    setActiveView('storefront');
    window.setTimeout(() => {
      document.getElementById('poshak-catalog')?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  const handleToggleDealsFromNav = () => {
    setDealsOnly((prev) => !prev);
    setActiveView('storefront');
    window.setTimeout(() => {
      document.getElementById('poshak-catalog')?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  const handleSelectProduct = (product: GarmentProduct) => {
    setActiveProduct(product);
    setActiveSize(product.sizes.includes('M') ? 'M' : product.sizes[0]);
    setActiveView('product');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStartTryOn = (
    product: GarmentProduct,
    mode: TryOnMode,
    size: GarmentSize = product.sizes.includes('M') ? 'M' : product.sizes[0]
  ) => {
    setActiveProduct(product);
    setActiveMode(mode);
    setActiveSize(size);
    setActiveView('fitting-room');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleWishlist = (productId: string) => {
    setWishlistIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
    setSavedLooks((prev) => {
      const exists = prev.some((l) => l.productId === productId && !l.previewDataUrl);
      if (exists) {
        return prev.filter((l) => !(l.productId === productId && !l.previewDataUrl));
      }
      const prod = GARMENTS.find((g) => g.id === productId);
      if (!prod) return prev;
      return [
        {
          id: `look-${Date.now()}`,
          productId,
          size: prod.sizes.includes('M') ? 'M' : prod.sizes[0],
          mode: 'dummy',
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ];
    });
  };

  const handleSaveLook = useCallback(
    (product: GarmentProduct, size: GarmentSize, mode: TryOnMode, previewDataUrl?: string) => {
      setSavedLooks((prev) => [
        {
          id: `look-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          productId: product.id,
          size,
          mode,
          previewDataUrl,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      if (!wishlistIds.includes(product.id)) {
        setWishlistIds((prev) => [...prev, product.id]);
      }
    },
    [wishlistIds]
  );

  const handleAddToBag = useCallback(
    (product: GarmentProduct, size: GarmentSize, quantity = 1) => {
      setBagItems((prev) => addItemToCart(prev, product, size, quantity));
    },
    []
  );

  const handleAddCatalogProductToCart = useCallback((product: GarmentProduct) => {
    const defaultSize: GarmentSize = product.sizes.includes('M') ? 'M' : product.sizes[0];
    setBagItems((prev) => addItemToCart(prev, product, defaultSize, 1));
  }, []);

  const handleSaveForLater = (item: CartItem) => {
    setBagItems((prev) => removeCartItem(prev, item.id));
    if (!wishlistIds.includes(item.product.id)) {
      setWishlistIds((prev) => [...prev, item.product.id]);
    }
    setSavedLooks((prev) => [
      {
        id: `look-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId: item.product.id,
        size: item.size,
        mode: 'dummy',
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  const handleMoveSavedToCart = (
    product: GarmentProduct,
    size: GarmentSize,
    lookId: string
  ) => {
    setBagItems((prev) => addItemToCart(prev, product, size, 1));
    setSavedLooks((prev) => prev.filter((l) => l.id !== lookId));
  };

  const handleProceedToCheckout = (promoCode: string) => {
    if (bagItems.length === 0) return;
    setDrawerOpen(false);
    setCheckoutItems(bagItems);
    setCheckoutSource('cart');
    setCheckoutPromo(promoCode);
    setCheckoutOpen(true);
  };

  const handleBuyNow = (product: GarmentProduct, size: GarmentSize, quantity: number) => {
    setCheckoutItems([
      {
        id: `buynow-${product.id}-${size}-${Date.now()}`,
        product,
        size,
        quantity: Math.max(1, quantity),
      },
    ]);
    setCheckoutSource('buy-now');
    setCheckoutPromo('');
    setCheckoutOpen(true);
  };

  const handleOrderPlaced = (order: OrderRecord) => {
    setOrders((prev) => [order, ...prev]);
    setLatestOrderId(order.id);
    if (checkoutSource === 'cart') {
      setBagItems([]);
    }
    setCheckoutOpen(false);
    setActiveView('orders');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      const resp = await fetch(`/api/orders/${encodeURIComponent(orderId)}/cancel`, {
        method: 'PATCH',
      });
      if (!resp.ok) return;
      const data = (await resp.json()) as { order?: OrderRecord };
      if (data.order) {
        setOrders((prev) => prev.map((o) => (o.id === orderId ? data.order! : o)));
      }
    } catch {
      // Ignore transient cancel failure
    }
  };

  const handleSubmitReview = (
    review: Omit<ProductReview, 'id' | 'dateLabel' | 'verifiedPurchase'>
  ) => {
    const created: ProductReview = {
      ...review,
      id: `rev-${Date.now()}`,
      dateLabel: 'Just now',
      verifiedPurchase: true,
    };
    setUserReviewsByProduct((prev) => ({
      ...prev,
      [review.productId]: [created, ...(prev[review.productId] ?? [])],
    }));
  };

  const handleSubmitStoreRequest = async (form: {
    customerName: string;
    phone: string;
    preferredTime: string;
    notes: string;
  }) => {
    const resp = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        items: bagItems.map((b) => ({
          productId: b.product.id,
          productName: b.product.name,
          sku: b.product.sku,
          size: b.size,
          price: b.product.price * b.quantity,
        })),
      }),
    });

    const data = (await resp.json()) as { request?: StoreRequest; error?: string };
    if (!resp.ok || !data.request) {
      throw new Error(data.error || 'Could not confirm reservation.');
    }
    setSubmittedRequests((prev) => [data.request!, ...prev]);
    setBagItems([]);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF9F6] text-[#171717]">
      <Navbar
        activeView={activeView}
        selectedCategory={selectedCategory}
        dealsOnly={dealsOnly}
        searchQuery={searchQuery}
        deliveryLocation={deliveryLocation}
        savedCount={savedLooks.length}
        ordersCount={orders.length}
        requestBagCount={totalCartCount}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearchSubmit}
        onSelectSearchCategory={setSelectedCategory}
        onNavigateHome={() => {
          setActiveView('storefront');
          setDealsOnly(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onNavigateCategory={handleSelectCategoryFromNav}
        onToggleDeals={handleToggleDealsFromNav}
        onOpenFittingRoom={() => {
          setActiveView('fitting-room');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenOrders={() => {
          setLatestOrderId(null);
          setActiveView('orders');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenLocationModal={() => setLocationModalOpen(true)}
        onOpenDrawer={(tab = 'cart') => {
          setDrawerTab(tab);
          setDrawerOpen(true);
        }}
      />

      <div key={activeView} className="poshak-smooth-view flex-1">
        {activeView === 'storefront' && (
          <main>
            <HeroSection onExploreCatalog={scrollToCatalog} />
            <CatalogSection
              products={GARMENTS}
              selectedCategory={selectedCategory}
              searchQuery={searchQuery}
              dealsOnly={dealsOnly}
              deliveryLocation={deliveryLocation}
              cartProductIds={cartProductIds}
              onSelectCategory={setSelectedCategory}
              onSearchChange={setSearchQuery}
              onToggleDeals={setDealsOnly}
              onSelectProduct={handleSelectProduct}
              onAddToCart={handleAddCatalogProductToCart}
              onQuickTryOn={(prod) => handleStartTryOn(prod, 'dummy')}
              wishlistIds={wishlistIds}
              onToggleWishlist={handleToggleWishlist}
            />
            <StorefrontBottomTitle
              onExploreCatalog={scrollToCatalog}
              onExploreDeals={() => {
                setDealsOnly(true);
                scrollToCatalog();
              }}
              onLaunchFittingRoom={() => handleStartTryOn(activeProduct, 'dummy')}
            />
          </main>
        )}

        {activeView === 'product' && (
          <ProductDetailView
            key={activeProduct.id}
            product={activeProduct}
            relatedProducts={relatedProducts}
            deliveryLocation={deliveryLocation}
            userReviews={userReviewsByProduct[activeProduct.id] ?? []}
            isWishlisted={wishlistIds.includes(activeProduct.id)}
            onBack={() => setActiveView('storefront')}
            onSelectProduct={handleSelectProduct}
            onStartTryOn={handleStartTryOn}
            onAddToBag={handleAddToBag}
            onBuyNow={handleBuyNow}
            onToggleWishlist={handleToggleWishlist}
            onSubmitReview={handleSubmitReview}
          />
        )}

        {activeView === 'fitting-room' && (
          <FittingRoom
            activeProduct={activeProduct}
            activeMode={activeMode}
            activeSize={activeSize}
            bodyParams={bodyParams}
            cartItems={bagItems}
            onChangeMode={setActiveMode}
            onSelectProduct={setActiveProduct}
            onSelectSize={setActiveSize}
            onUpdateBodyParams={setBodyParams}
            onBackToCatalog={() => setActiveView('storefront')}
            onSaveLook={handleSaveLook}
            onAddToBag={handleAddToBag}
          />
        )}

        {activeView === 'orders' && (
          <OrdersView
            orders={orders}
            storeRequests={submittedRequests}
            latestOrderId={latestOrderId}
            onBackToShop={() => {
              setActiveView('storefront');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onBuyAgain={(prod, sz) => {
              handleAddToBag(prod, sz, 1);
              setDrawerTab('cart');
              setDrawerOpen(true);
            }}
            onTryOn={(prod, sz) => handleStartTryOn(prod, 'dummy', sz)}
            onCancelOrder={handleCancelOrder}
          />
        )}
      </div>

      <footer className="mt-12 border-t border-[#E5E1D8] bg-[#F3F1EC] py-8 text-[#57544E]">
        <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-4 px-4 text-xs sm:flex-row sm:px-8">
          <div className="flex items-center gap-2.5">
            <span className="font-display text-2xl font-semibold text-[#171717]">Poshak</span>
            <span aria-hidden="true">·</span>
            <span>Virtual Try-On Atelier &amp; Flagship Boutique</span>
          </div>
          <p className="text-center sm:text-right">
            7-Day Easy Exchanges · Complimentary Delivery above ₹1,999 · Verified Atelier Craft
          </p>
        </div>
      </footer>

      <SavedLooksDrawer
        open={drawerOpen}
        initialTab={drawerTab}
        bagItems={bagItems}
        savedLooks={savedLooks}
        onClose={() => setDrawerOpen(false)}
        onUpdateCartQty={(id, delta) =>
          setBagItems((prev) => updateCartItemQuantity(prev, id, delta))
        }
        onRemoveBagItem={(id) => setBagItems((prev) => removeCartItem(prev, id))}
        onSaveForLater={handleSaveForLater}
        onMoveSavedToCart={handleMoveSavedToCart}
        onRemoveSavedLook={(id) => setSavedLooks((prev) => prev.filter((l) => l.id !== id))}
        onTrySavedLook={(prod, sz) => {
          setDrawerOpen(false);
          handleStartTryOn(prod, 'dummy', sz);
        }}
        onProceedToCheckout={handleProceedToCheckout}
        onSubmitStoreRequest={handleSubmitStoreRequest}
      />

      <DeliveryLocationModal
        open={locationModalOpen}
        current={deliveryLocation}
        onClose={() => setLocationModalOpen(false)}
        onSelectLocation={setDeliveryLocation}
      />

      <CheckoutModal
        open={checkoutOpen}
        items={checkoutItems}
        deliveryLocation={deliveryLocation}
        initialPromoCode={checkoutPromo}
        onClose={() => setCheckoutOpen(false)}
        onOrderPlaced={handleOrderPlaced}
      />
    </div>
  );
}

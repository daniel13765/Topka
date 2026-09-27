import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import toast from 'react-hot-toast';
import ClientNavbar from '../../../components/layout/client/ClientNavbar';
import ClientFooter from '../../../components/layout/client/ClientFooter';
import ClientBottomNav from '../../../components/layout/client/ClientBottomNav';
import MIcon from '../../../components/shared/MIcon';
import { alertApiError } from '../../../utils/apiError';
import EmptyState from '../../../components/shared/EmptyState';
import { useAppDispatch, useAppSelector } from '../../../hooks/useStore';
import { clear, remove, setQuantity, selectCount, selectSubtotal, selectSavings } from '../../../store/slices/cart/cartSlice';
import { authApi, catalogApi, landmarksApi, ordersApi, paymentsApi } from '../../../services/api';
import { useLanguage } from '../../../context/LanguageContext';
import { tx } from '../../../i18n/tx';


interface ApiLandmark {
  id: number;
  nom: string;
  description?: string;
  latitude?: number;
  longitude?: number;
}

interface ApiZone {
  id: number;
  nom: string;
  km_prix: number;
  min_prix: number;
  points_repere?: ApiLandmark[];
}

/** Un « point de repère » de l'utilisateur : ligne réelle point_reperes (rowId) ou entrée profil JSON. */
interface MyLandmark {
  key: string;
  nom: string;
  description: string;
  rowId?: number;
  zoneId?: number;
}

interface ConfirmationPayload {
  orderId: number;
  total: number;
  zoneNom: string;
  landmarkNom: string;
  nbItems: number;
  /** Données du paiement renvoyées par POST /payments/init → relues par la confirmation. */
  paymentId?: number;
  paymentRef?: string;
  paymentCurrency?: string;
}

/**
 * Page Panier & Caisse — 100 % API backend :
 *   - GET  /api/zones                → zones + points de repère (réels, seedés)
 *   - POST /api/orders               → landmark_id requis (point_reperes), description_lieu, payment_method
 *   - POST /api/payments/init        → FedaPay (sandbox dev : token local, url {APP_URL}/payments/sandbox/{token})
 * Le frais de livraison affiché = `km_prix` de la zone (DeliveryFeeCalculator du backend).
 * Le panier est synchronisé avec le serveur par SystemBridge (useCartSync).
 */
export default function CartPage() {
  useLanguage();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const items = useAppSelector((s) => s.cart.items);
  const count = useAppSelector((s) => selectCount(s.cart.items));
  const subtotal = useAppSelector((s) => selectSubtotal(s.cart.items));
  const savings = useAppSelector((s) => selectSavings(s.cart.items));

  // Zones + points de repère (backend)
  const [zones, setZones] = useState<ApiZone[]>([]);
  const [zonesLoading, setZonesLoading] = useState(true);
  const [zoneId, setZoneId] = useState<number | null>(null);
  const [landmarkId, setLandmarkId] = useState<number | null>(null);
  const [landmarkSel, setLandmarkSel] = useState<string>('');
  const [landmarkNomSel, setLandmarkNomSel] = useState<string | null>(null);
  const [myLandmarks, setMyLandmarks] = useState<MyLandmark[]>([]);
  const [descriptionLieu, setDescriptionLieu] = useState('');
  const [landmarkError, setLandmarkError] = useState(false);
  const [loading, setLoading] = useState(false);

  const selectedZone = zones.find((z) => z.id === zoneId) ?? null;
  const deliveryFee = selectedZone ? Number(selectedZone.km_prix) : 0;
  const grandTotal = Math.max(0, subtotal - savings + deliveryFee);

  // 1) Chargement des zones de livraison (GET /api/zones)
  useEffect(() => {
    catalogApi
      .getZones()
      .then((res) => {
        const list: ApiZone[] = res?.data ?? (Array.isArray(res) ? res : []);
        setZones(list);
        if (list.length > 0) setZoneId((prev) => prev ?? list[0].id);
      })
      .catch((err) => {
        alertApiError(err, 'cart-zones');
      })
      .finally(() => setZonesLoading(false));
  }, []);

  // 2) Mes points de repère à MOI : lignes réelles (GET /landmarks) + entrées du profil (client.point_repere)
  useEffect(() => {
    let alive = true;
    (async () => {
      const list: MyLandmark[] = [];
      try {
        const res = await landmarksApi.getLandmarks();
        const rows: Array<Record<string, unknown>> = Array.isArray(res) ? res : ((res?.data ?? []) as Array<Record<string, unknown>>);
        rows.forEach((r, i) => {
          list.push({
            key: `row-${r.id ?? i}`,
            nom: String(r.nom ?? tx("Point de repère")),
            description: String(r.description ?? ''),
            rowId: Number(r.id),
            zoneId: r.zone_id != null ? Number(r.zone_id) : undefined,
          });
        });
      } catch {
        /* GET /landmarks indisponible (B-13 backend) ou hors ligne */
      }
      try {
        const res = await authApi.getProfile();
        const profil = ((res?.data ?? res) as { profil?: Record<string, unknown> })?.profil;
        const raw = profil?.point_repere;
        if (Array.isArray(raw)) {
          raw.forEach((item, i) => {
            if (typeof item === 'string') {
              if (!list.some((l) => l.nom === item)) list.push({ key: `mine-${i}`, nom: item, description: '' });
            } else if (item && typeof item === 'object') {
              const o = item as Record<string, unknown>;
              const nom = String(o.nom ?? tx("Point de repère"));
              const description = String(o.landmark ?? o.description ?? '');
              if (!list.some((l) => l.nom === nom)) list.push({ key: `mine-${i}`, nom, description });
            }
          });
        }
      } catch {
        /* profil indisponible */
      }
      if (alive) setMyLandmarks(list);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const handleZoneChange = (id: number) => {
    setZoneId(id);
    setLandmarkId(null);
    setLandmarkSel('');
    setLandmarkNomSel(null);
  };

  const handlePaid = async () => {
    if (!selectedZone) {
      toast.error(tx("Sélectionnez une zone de livraison."));
      return;
    }
    if (!landmarkId) {
      setLandmarkError(true);
      toast.error(tx("Sélectionnez un point de repère."));
      return;
    }

    setLoading(true);
    try {
      // 1) POST /api/orders — le backend vérifie stock + dispo et vide le panier serveur
      const orderRes = await ordersApi.createOrder({
        items: items.map((item) => ({
          product_id: Number(item.product.id),
          quantite: item.quantite,
        })),
        landmark_id: landmarkId,
        description_lieu: descriptionLieu.trim() || undefined,
        payment_method: 'fedapay',
      });

      const orderData = orderRes?.data ?? orderRes;
      const orderId: number = orderData?.id ?? 0;
      const orderTotal: number = Number(orderData?.montant_total ?? grandTotal);
      const landmarkNom: string =
        landmarkNomSel ??
        (selectedZone.points_repere ?? []).find((l) => l.id === landmarkId)?.nom ??
        selectedZone.nom;

      // 2) POST /api/payments/init — FedaPay (sandbox si SDK absent)
      let paymentId: number | undefined;
      let paymentRef: string | undefined;
      let paymentCurrency = 'XOF';
      try {
        const paymentRes = await paymentsApi.initPayment({ order_id: orderId });
        const payment = paymentRes?.payment;
        paymentId = Number(payment?.id) || undefined;
        paymentRef = payment?.fedapay_ref ?? undefined;
        paymentCurrency = paymentRes?.currency || 'XOF';
        const redirectUrl: string | undefined = paymentRes?.redirect_url ?? undefined;
        if (redirectUrl) {
          const isRealFedaPay = /fedapay\.com/i.test(redirectUrl);
          if (isRealFedaPay) {
            window.open(redirectUrl, '_blank', 'noopener');
            toast.success('Redirection vers FedaPay…');
          } else {
            toast.success(tx("Paiement FedaPay initialisé (mode sandbox dev)."));
          }
        }
      } catch (payErr) {
        // Commande déjà enregistrée : on prévient que le paiement n'a pas pu démarrer (message de l'API)
        alertApiError(payErr, 'cart-payment');
      }

      // 3) Nettoyage local + confirmation avec les données réelles
      dispatch(clear());
      toast.success(tx("Commande enregistrée avec succès !"));
      const payload: ConfirmationPayload = {
        orderId,
        total: orderTotal,
        zoneNom: selectedZone.nom,
        landmarkNom,
        nbItems: count,
        paymentId,
        paymentRef,
        paymentCurrency,
      };
      navigate({ to: '/confirmation', state: payload as unknown as Record<string, unknown> });
    } catch (err: unknown) {
      // Statut + message exact de l'API (erreurs de validation comprises)
      alertApiError(err, 'cart-order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-bg-app font-body text-text-main">
      <ClientNavbar />

      {/* Main Content Container */}
      <main className="mt-[52px] md:mt-[64px] flex-grow w-full max-w-[1200px] mx-auto px-md md:px-lg py-xl pb-24">
        {/* Progress Bar Stepper */}
        <div className="w-full mb-xl overflow-x-auto">
          <div className="flex items-center justify-between min-w-[600px] md:w-full relative px-xl py-2">
            {/* Line Background */}
            <div className="absolute top-[22px] left-[60px] right-[60px] h-[3px] bg-border-default -z-10 rounded-full" />
            {/* Active Line Fill */}
            <div className="absolute top-[22px] left-[60px] w-[33%] h-[3px] bg-primary-container -z-10 rounded-full" />

            {/* Step 1: Panier (Completed) */}
            <div className="flex flex-col items-center gap-sm text-primary-container">
              <div className="w-9 h-9 rounded-full border-2 border-primary-container bg-white text-primary-container flex items-center justify-center font-bold text-h3 transition-all duration-300">
                <MIcon name="check" style={{ fontSize: 20 }} />
              </div>
              <span className="font-label text-label font-medium text-primary-container">{tx("Panier")}</span>
            </div>

            {/* Step 2: Livraison (Active) */}
            <div className="flex flex-col items-center gap-sm text-primary-container">
              <div className="w-9 h-9 rounded-full border-2 border-primary-container bg-primary-container text-white flex items-center justify-center font-bold text-h3 shadow-md transition-all duration-300">
                2
              </div>
              <span className="font-label text-label font-bold text-primary-container">{tx("Livraison")}</span>
            </div>

            {/* Step 3: Paiement */}
            <div className="flex flex-col items-center gap-sm text-text-tertiary">
              <div className="w-9 h-9 rounded-full border-2 border-border-default bg-bg-app text-text-tertiary flex items-center justify-center font-bold text-h3 transition-all duration-300">
                3
              </div>
              <span className="font-label text-label font-medium text-text-tertiary">{tx("Paiement")}</span>
            </div>

            {/* Step 4: Confirmation */}
            <div className="flex flex-col items-center gap-sm text-text-tertiary">
              <div className="w-9 h-9 rounded-full border-2 border-border-default bg-bg-app text-text-tertiary flex items-center justify-center font-bold text-h3 transition-all duration-300">
                4
              </div>
              <span className="font-label text-label font-medium text-text-tertiary">Confirmation</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-lg">
          {/* Left Column: Basket & Delivery */}
          <div className="lg:w-[60%] flex flex-col gap-lg">
            {/* Articles Section */}
            <div className="bg-white rounded-lg p-lg shadow-sm border border-border-default/50">
              <div className="flex items-center gap-sm mb-lg border-b border-border-default pb-md">
                <MIcon name="shopping_cart" className="text-primary-container" />
                <h2 className="font-h2 text-h2 text-on-surface">Votre panier ({count} articles)</h2>
              </div>

              {/* Article List */}
              {items.length === 0 ? (
                <EmptyState
                  icon={<MIcon name="shopping_cart" className="text-4xl text-primary" />}
                  title={tx("Votre panier est vide")}
                  description={tx("Ajoutez des produits frais du marché pour commencer vos achats.")}
                  action={
                    <button
                      type="button"
                      className="px-lg py-3 bg-primary-container hover:bg-primary-hover text-white rounded-lg font-bold transition-all shadow-md cursor-pointer"
                      onClick={() => navigate({ to: '/catalogue' })}
                    >
                      {tx("Explorer le marché")}
                    </button>
                  }
                />
              ) : (
                <div className="flex flex-col gap-md">
                  {items.map((item) => {
                    const isNegotiated = !!item.product.negotiated;
                    const unitPrice = item.product.prix;
                    const oldPrice = item.product.negotiated?.oldPrice;

                    return (
                      <div
                        key={item.product.id}
                        className="flex items-center gap-md py-md border-b border-border-default last:border-0 group"
                      >
                        {/* Thumbnail */}
                        <div className="w-20 h-20 rounded-lg flex-shrink-0 bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center relative overflow-hidden">
                          {item.product.image ? (
                            <img
                              src={item.product.image}
                              alt={item.product.nom}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          ) : (
                            <MIcon name="psychiatry" className="text-primary-container text-[32px]" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-grow min-w-0">
                          <div className="flex items-center gap-sm mb-xs flex-wrap">
                            <h3 className="font-h3 text-h3 text-on-surface truncate font-bold">{item.product.nom}</h3>
                            {isNegotiated && (
                              <span className="bg-[#F59E0B]/10 text-[#F59E0B] text-micro px-2 py-0.5 rounded-full border border-[#F59E0B]/20 font-bold uppercase tracking-wider">
                                {tx("Offre acceptée")}
                              </span>
                            )}
                          </div>
                          <p className="text-secondary text-text-secondary truncate">
                            {[item.product.origine, item.product.quantite].filter(Boolean).join(' · ')}
                          </p>

                          <div className="flex items-center gap-sm mt-xs">
                            <p className="font-price text-primary-container font-bold">
                              {unitPrice.toLocaleString('fr-FR')} FCFA
                            </p>
                            {oldPrice && (
                              <p className="text-secondary text-text-tertiary line-through">
                                {oldPrice.toLocaleString('fr-FR')} FCFA
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Quantity & Delete */}
                        <div className="flex flex-col items-end gap-md">
                          <div className="flex items-center bg-bg-app rounded-[6px] p-0.5 border border-border-default">
                            <button
                              type="button"
                              onClick={() =>
                                dispatch(setQuantity({ productId: item.product.id, quantity: Math.max(1, item.quantite - 1) }))
                              }
                              className="w-8 h-8 flex items-center justify-center text-primary-container hover:bg-primary-tint rounded-[4px] transition-colors cursor-pointer font-bold"
                            >
                              -
                            </button>
                            <span className="px-3 font-bold text-on-surface">{item.quantite}</span>
                            <button
                              type="button"
                              onClick={() =>
                                dispatch(setQuantity({ productId: item.product.id, quantity: item.quantite + 1 }))
                              }
                              className="w-8 h-8 flex items-center justify-center text-primary-container hover:bg-primary-tint rounded-[4px] transition-colors cursor-pointer font-bold"
                            >
                              +
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => dispatch(remove(item.product.id))}
                            className="text-error hover:bg-error-light p-2 rounded-full transition-colors opacity-80 sm:opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                            title={tx("Supprimer")}
                          >
                            <MIcon name="delete" className="text-[20px]" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Point de Repère Section — zones + points de repère réels (GET /api/zones) */}
            <div className="bg-white rounded-lg p-lg shadow-sm border border-border-default/50">
              <div className="flex items-center gap-sm mb-lg">
                <MIcon name="location_on" className="text-primary-container" />
                <h2 className="font-h2 text-h2 text-on-surface">{tx("Lieu de livraison")}</h2>
              </div>
              <div className="space-y-md">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                  <div>
                    <label className="block font-label text-secondary text-text-secondary mb-xs">
                      {tx("Zone de livraison")}
                    </label>
                    <div className="relative">
                      <MIcon name="map" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                      <select
                        className="w-full pl-10 pr-10 py-3 bg-white rounded-lg border-1.5 border-border-default appearance-none focus:border-primary-container focus:ring-1 focus:ring-primary-container outline-none transition-all text-body disabled:opacity-60"
                        value={zoneId ?? ''}
                        onChange={(e) => handleZoneChange(Number(e.target.value))}
                        disabled={zonesLoading}
                      >
                        {zonesLoading && <option value="">{tx("Chargement des zones…")}</option>}
                        {zones.map((z) => (
                          <option key={z.id} value={z.id}>
                            {z.nom}
                          </option>
                        ))}
                      </select>
                      <MIcon name="expand_more" className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block font-label text-secondary text-text-secondary mb-xs">
                      {tx("Point de repère")} <span className="text-error">*</span>
                    </label>
                    <div className="relative">
                      <MIcon name="edit_location" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                      <select
                        className={`w-full pl-10 pr-10 py-3 bg-white rounded-lg border-1.5 appearance-none focus:border-primary-container focus:ring-1 focus:ring-primary-container outline-none transition-all text-body disabled:opacity-60 ${
                          landmarkError ? 'border-error' : 'border-border-default'
                        }`}
                        value={landmarkSel}
                        onChange={(e) => {
                          const v = e.target.value;
                          setLandmarkSel(v);
                          if (!v) {
                            setLandmarkId(null);
                            setLandmarkNomSel(null);
                            return;
                          }
                          setLandmarkError(false);
                          const personal = myLandmarks.find((l) => l.key === v);
                          if (personal) {
                            setLandmarkNomSel(personal.nom);
                            if (personal.rowId) {
                              // Ligne point_reperes réelle → landmark_id direct (frais de sa zone)
                              setLandmarkId(personal.rowId);
                              if (personal.zoneId) setZoneId(personal.zoneId);
                            } else {
                              // Repère du profil (JSON) → ancrage = 1er point public de la zone
                              // (l'API exige un landmark_id exists:point_reperes ; le vrai lieu part dans description_lieu)
                              setLandmarkId(selectedZone?.points_repere?.[0]?.id ?? null);
                            }
                            if (!descriptionLieu.trim()) {
                              setDescriptionLieu(
                                personal.description ? `${personal.nom} — ${personal.description}` : personal.nom,
                              );
                            }
                          } else {
                            const zid = Number(v.replace('zone-', ''));
                            setLandmarkId(Number.isFinite(zid) ? zid : null);
                            setLandmarkNomSel(
                              selectedZone?.points_repere?.find((l) => l.id === zid)?.nom ?? null,
                            );
                          }
                        }}
                        disabled={
                          myLandmarks.length === 0 &&
                          (!selectedZone || (selectedZone.points_repere ?? []).length === 0)
                        }
                      >
                        <option value="">
                          {myLandmarks.length === 0 && (!selectedZone || (selectedZone.points_repere ?? []).length === 0)
                            ? tx("Aucun point de repère disponible")
                            : tx("Sélectionner un point de repère…")}
                        </option>
                        {myLandmarks.length > 0 && (
                          <optgroup label={tx("Mes points de repère")}>
                            {myLandmarks.map((l) => (
                              <option key={l.key} value={l.key}>
                                {l.nom}
                                {!l.rowId ? ' (profil)' : ''}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {(selectedZone?.points_repere ?? []).length > 0 && (
                          <optgroup label={`Points de la zone ${selectedZone?.nom ?? ''}`}>
                            {(selectedZone?.points_repere ?? []).map((l) => (
                              <option key={l.id} value={`zone-${l.id}`}>
                                {l.nom}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                      <MIcon name="expand_more" className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
                    </div>
                    {landmarkError && (
                      <p className="mt-1 text-xs font-semibold text-error">
                        {tx("Le point de repère est requis pour la livraison.")}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block font-label text-secondary text-text-secondary mb-xs">
                    Description du lieu exact (optionnel)
                  </label>
                  <div className="relative">
                    <MIcon name="edit" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                    <input
                      className="w-full pl-10 pr-4 py-3 bg-white rounded-lg border-1.5 border-border-default focus:border-primary-container focus:ring-1 focus:ring-primary-container outline-none transition-all text-body"
                      type="text"
                      value={descriptionLieu}
                      onChange={(e) => setDescriptionLieu(e.target.value)}
                      placeholder={tx("Ex : face à la pharmacie, portail bleu…")}
                      maxLength={255}
                    />
                  </div>
                </div>

                <div className="bg-primary-tint p-lg rounded-lg border border-primary-light flex items-center justify-between">
                  <span className="text-body font-medium text-on-primary-container">
                    Frais de livraison {selectedZone ? `(zone ${selectedZone.nom})` : ''}
                  </span>
                  <span className="font-price text-primary-container font-bold">
                    {deliveryFee.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Summary (Sticky) */}
          <div className="lg:w-[40%]">
            <div className="bg-white rounded-lg p-lg shadow-sm border border-border-default/50 sticky top-[72px]">
              <h2 className="font-h2 text-h2 text-on-surface mb-lg">{tx("Récapitulatif")}</h2>
              <div className="space-y-sm pb-lg border-b border-border-default">
                <div className="flex justify-between items-center">
                  <span className="text-body text-text-secondary">{tx("Sous-total")}</span>
                  <span className="text-body font-medium text-on-surface">
                    {subtotal.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
                {savings > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-body text-text-secondary">{tx("Économie (négociations)")}</span>
                    <span className="text-body font-medium text-success">
                      -{savings.toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-body text-text-secondary">{tx("Frais de livraison")}</span>
                  <span className="text-body font-medium text-on-surface">
                    {deliveryFee.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
              </div>

              <div className="py-lg flex justify-between items-center">
                <span className="font-h2 text-h2 text-on-surface">Total</span>
                <span className="font-price text-[22px] text-primary-container font-bold">
                  {grandTotal.toLocaleString('fr-FR')} FCFA
                </span>
              </div>

              <div className="flex flex-col gap-md">
                <button
                  type="button"
                  onClick={handlePaid}
                  disabled={items.length === 0 || loading}
                  className="w-full py-4 bg-primary-container hover:bg-primary-hover text-white rounded-lg font-h3 flex items-center justify-center gap-sm transition-all transform active:scale-95 shadow-md shadow-primary-container/20 cursor-pointer disabled:opacity-50"
                >
                  <MIcon name="credit_card" />
                  {loading ? 'Traitement de la commande...' : tx("Payer avec FedaPay")}
                </button>

                <div className="flex items-center justify-center gap-xs py-sm px-md bg-success-light text-success-dark rounded-full border border-success-light">
                  <MIcon name="verified_user" className="text-[18px]" />
                  <span className="text-micro font-bold">{tx("Paiement sécurisé FedaPay")}</span>
                </div>

                <button
                  type="button"
                  onClick={() => navigate({ to: '/catalogue' })}
                  className="w-full py-3 border-2 border-primary-container text-primary-container hover:bg-primary-tint rounded-lg font-label font-bold transition-colors cursor-pointer"
                >
                  {tx("Continuer les achats")}
                </button>
              </div>

              <div className="mt-lg p-md bg-bg-app rounded-lg">
                <div className="flex gap-sm">
                  <MIcon name="info" className="text-info shrink-0" />
                  <p className="text-secondary text-text-secondary">
                    {tx("Livraison par nos coursiers partenaires TOKPa Express — le livreur se présente au point de repère choisi.")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <ClientFooter />
      <ClientBottomNav />
    </div>
  );
}

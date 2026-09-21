import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { faArrowRight, faCheck, faClock, faCommentDots, faHandshake, faRotateRight, faXmark } from '@fortawesome/free-solid-svg-icons';
import { MarketplaceHeader } from '../../components/layout/MarketplaceHeader';
import { Badge } from '../../components/ui/Badge';
import { Icon } from '../../components/ui/Icon';
import { useAnswerNegotiationMutation, useListNegotiationsQuery, statusByValue } from '../../services/api/negotiationsApi';
import type { NegotiationStatus } from '../../types/domain';
import { formatFCFA } from '../../utils/formatFCFA';

type Tab = 'all' | NegotiationStatus;
const tabs: Array<{ id: Tab; label: string }> = [{ id: 'all', label: 'Toutes' }, { id: 'pending', label: 'En cours' }, { id: 'countered', label: 'Contre-propositions' }, { id: 'accepted', label: 'Acceptées' }, { id: 'rejected', label: 'Refusées' }];

const statusTone: Record<NegotiationStatus, 'orange' | 'blue' | 'green' | 'slate'> = { pending: 'orange', countered: 'blue', accepted: 'green', rejected: 'slate' };

export function NegotiationsPage() {
  const { data: negotiations = [], isLoading } = useListNegotiationsQuery();
  const [answer, { isLoading: isAnswering }] = useAnswerNegotiationMutation();
  const [tab, setTab] = useState<Tab>('all');
  const [notice, setNotice] = useState('');
  const visible = useMemo(() => tab === 'all' ? negotiations : negotiations.filter((negotiation) => negotiation.status === tab), [negotiations, tab]);

  const answerCounter = async (id: string, action: 'accept' | 'reject', offer?: number) => {
    try {
      await answer({ id, action, offer }).unwrap();
      setNotice(action === 'accept' ? 'La contre-proposition a été acceptée.' : 'La contre-proposition a été refusée.');
      window.setTimeout(() => setNotice(''), 3000);
    } catch {
      setNotice('Impossible de répondre à cette proposition.');
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <MarketplaceHeader active="negotiations" />
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="eyebrow">Prix discutés avec les vendeurs</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Mes négociations</h1><p className="mt-2 text-slate-500">Suivez vos offres en cours, vos contre-propositions et vos meilleures affaires.</p></div><Link to="/catalogue" className="btn-primary">Trouver un produit <Icon icon={faArrowRight} className="ml-2" /></Link></div>
        <div className="mt-8 flex gap-2 overflow-x-auto border-b border-slate-200 pb-px">{tabs.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`shrink-0 border-b-2 px-4 py-3 text-sm font-bold transition ${tab === item.id ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{item.label}{item.id !== 'all' && <span className="ml-2 text-xs text-slate-400">{negotiations.filter((negotiation) => negotiation.status === item.id).length}</span>}</button>)}</div>
        {notice && <div role="status" className="motion-enter mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{notice}</div>}
        <div className="mt-6 grid gap-4">
          {isLoading && Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-40 animate-pulse rounded-2xl bg-white" />)}
          {!isLoading && visible.map((negotiation) => <article key={negotiation.id} className="motion-enter rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md sm:p-6"><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><img src={negotiation.productImage} alt="" className="h-24 w-24 rounded-2xl bg-orange-50 object-cover" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Vendu par · {negotiation.seller}</p><h2 className="mt-1 text-lg font-black">{negotiation.productName}</h2></div><Badge tone={statusTone[negotiation.status]}><Icon icon={negotiation.status === 'accepted' ? faCheck : negotiation.status === 'countered' ? faCommentDots : negotiation.status === 'rejected' ? faXmark : faClock} className="mr-2" />{statusByValue[negotiation.status]}</Badge></div><div className="mt-4 flex flex-wrap items-end gap-5 text-sm"><div><p className="text-slate-400">Prix vendeur</p><p className="font-black text-slate-700">{formatFCFA(negotiation.sellerPrice)}</p></div><div><p className="text-slate-400">Votre offre</p><p className="font-black text-brand-600">{formatFCFA(negotiation.offer)}</p></div>{negotiation.sellerOffer && <div><p className="text-slate-400">Contre-proposition</p><p className="font-black text-orange-700">{formatFCFA(negotiation.sellerOffer)}</p></div>}<span className="text-xs text-slate-400">{negotiation.updatedAt}</span></div></div></div>{negotiation.status === 'countered' && <div className="mt-5 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4"><button type="button" disabled={isAnswering} onClick={() => void answerCounter(negotiation.id, 'reject')} className="btn-secondary !border-slate-200 !bg-white !text-slate-600"><Icon icon={faXmark} className="mr-2" /> Refuser</button><button type="button" disabled={isAnswering} onClick={() => void answerCounter(negotiation.id, 'accept', negotiation.sellerOffer)} className="btn-primary"><Icon icon={faCheck} className="mr-2" /> Accepter {formatFCFA(negotiation.sellerOffer || negotiation.offer)}</button></div>}</article>)}
          {!isLoading && visible.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><Icon icon={faHandshake} className="text-3xl text-slate-300" /><h2 className="mt-4 text-lg font-black">Aucune négociation dans cette catégorie</h2><p className="mt-2 text-sm text-slate-500">Parcourez le catalogue pour proposer votre budget.</p></div>}
        </div>
      </div>
    </main>
  );
}

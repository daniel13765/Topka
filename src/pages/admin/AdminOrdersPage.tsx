import { useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/admin/AdminLayout';
import { adminApi } from '../../services/api';
import { listOf, unwrap, fmtFcfa } from '../../services/api/unwrap';
import { useLanguage } from '../../context/LanguageContext';
import { tx } from '../../i18n/tx';


export default function AdminOrdersPage() {
  useLanguage();
  const [orders, setOrders] = useState<any[]>([]), [status, setStatus] = useState(''), [zone, setZone] = useState(''), [zones, setZones] = useState<any[]>([]), [selected, setSelected] = useState<any>(null);
  useEffect(() => { adminApi.getZones().then(r => setZones(listOf(unwrap(r)))); }, []);
  useEffect(() => { adminApi.getOrders({ page: 1, ...(status ? { statut: status } : {}), ...(zone ? { zone_id: Number(zone) } : {}) }).then(r => setOrders(listOf(unwrap(r)).map((x: any) => x.data ?? x))); }, [status, zone]);
  return <AdminLayout currentPath="/admin/commandes"><div className="space-y-6"><div><h1 className="text-h2 font-bold">{tx("Commandes")}</h1><p className="text-text-secondary">{tx("Liste réelle — GET /admin/orders")}</p></div><div className="flex flex-wrap gap-3"><select value={status} onChange={e => setStatus(e.target.value)} className="rounded-lg border p-2"><option value="">{tx("Tous les statuts")}</option>{["en_attente",'en_preparation','en_livraison','livre','annule'].map(s => <option key={s}>{s}</option>)}</select><select value={zone} onChange={e => setZone(e.target.value)} className="rounded-lg border p-2"><option value="">{tx("Toutes les zones")}</option>{zones.map(z => <option key={z.id} value={z.id}>{z.nom}</option>)}</select></div><div className="overflow-x-auto rounded-lg border bg-white"><table className="w-full text-left text-label"><thead><tr className="bg-bg-secondary"><th className="p-3">{tx("Commande")}</th><th className="p-3">{tx("Client")}</th><th className="p-3">Zone</th><th className="p-3">{tx("Statut")}</th><th className="p-3">{tx("Montant")}</th><th className="p-3" /></tr></thead><tbody>{orders.map(o => <tr key={o.id} className="border-t"><td className="p-3 font-bold">#{o.id}</td><td className="p-3">{o.client?.nom_complet ?? o.user?.nom_complet ?? '—'}</td><td className="p-3">{zones.find(z => z.id === o.landmark?.zone_id)?.nom ?? o.landmark?.zone_id ?? '—'}</td><td className="p-3">{o.statut}</td><td className="p-3 font-bold">{fmtFcfa(o.montant_total)}</td><td className="p-3"><button className="text-primary font-bold" onClick={() => setSelected(o)}>{tx("Détail")}</button></td></tr>)}</tbody></table></div>{selected && <div className="rounded-lg border bg-white p-5"><div className="flex justify-between"><h2 className="font-bold">Détail de la commande #{selected.id}</h2><button onClick={() => setSelected(null)}>{tx("Fermer")}</button></div><pre className="mt-3 overflow-auto text-xs">{JSON.stringify(selected, null, 2)}</pre></div>}</div></AdminLayout>;
}

import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  faBell,
  faChevronDown,
  faEye,
  faFloppyDisk,
  faGear,
  faLayerGroup,
  faLocationDot,
  faMagnifyingGlassPlus,
  faMagnifyingGlassMinus,
  faMapLocationDot,
  faPen,
  faPlus,
  faRightFromBracket,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { Icon } from '../../components/ui/Icon';
import { useAddLandmarkMutation, useCreateZoneMutation, useListZonesQuery, useUpdateZoneMutation } from '../../services/api/zonesApi';
import type { ManagerZone } from '../../types/zones';
import { formatFCFA } from '../../utils/formatFCFA';

const zoneManagers = ['Moussa Soglo (Zone Manager)', 'Aminata Hounkpatin (Zone Manager)', 'Koffi Dossou (Zone Manager)'];

function ZoneMap({ zones, selectedId }: { zones: ManagerZone[]; selectedId: string }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-[#dcecf5] p-4 shadow-sm">
      <div className="absolute left-5 top-5 z-10 rounded-xl bg-white/95 px-4 py-3 shadow-sm"><p className="text-xs font-black uppercase tracking-wider text-slate-900">Visualisation géo</p><p className="text-sm text-slate-500">Cotonou, Bénin</p></div>
      <svg viewBox="0 0 640 360" className="h-[360px] w-full" role="img" aria-label="Carte des zones de Cotonou">
        <defs><pattern id="map-grid" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M 36 0 L 0 0 0 36" fill="none" stroke="#c5dce9" strokeWidth="1" opacity=".65" /></pattern></defs>
        <rect width="640" height="360" fill="#dcecf5" /><rect width="640" height="360" fill="url(#map-grid)" opacity=".7" />
        <path d="M0 255 C100 230 170 270 240 247 S390 205 470 235 S570 270 640 245 L640 360 L0 360Z" fill="#c9e2ec" opacity=".8" />
        {zones.map((zone) => <g key={zone.id}><polygon points={zone.polygon} fill={zone.id === selectedId ? '#eebd9b' : '#eaded4'} stroke={zone.id === selectedId ? '#ec721c' : '#e3a477'} strokeWidth={zone.id === selectedId ? 4 : 2} /><circle cx={zone.labelX} cy={zone.labelY} r="6" fill={zone.id === selectedId ? '#ad500b' : '#9b785f'} stroke="white" strokeWidth="3" /><text x={zone.labelX + 12} y={zone.labelY + 5} fontSize="12" fontWeight="700" fill="#8b4c23">{zone.name}</text></g>)}
      </svg>
      <div className="absolute bottom-5 right-5 flex items-center gap-2"><button type="button" className="grid h-11 w-11 place-items-center rounded-full bg-white text-slate-800 shadow-md transition hover:bg-orange-50 hover:text-brand-600" aria-label="Zoom avant"><Icon icon={faMagnifyingGlassPlus} /></button><button type="button" className="grid h-11 w-11 place-items-center rounded-full bg-white text-slate-800 shadow-md transition hover:bg-orange-50 hover:text-brand-600" aria-label="Zoom arrière"><Icon icon={faMagnifyingGlassMinus} /></button><button type="button" className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 font-semibold text-slate-700 shadow-md transition hover:bg-orange-50 hover:text-brand-600"><Icon icon={faLayerGroup} /> Calques</button></div>
    </div>
  );
}

function ZoneCard({ zone, selected, onSelect }: { zone: ManagerZone; selected: boolean; onSelect: () => void }) {
  return <button type="button" onClick={onSelect} className={`w-full rounded-2xl border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md ${selected ? 'border-orange-500 bg-[#fff7ed] shadow-sm' : 'border-slate-200 bg-white'}`}><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-black text-slate-900">{zone.name}</h2><p className="mt-2 text-sm font-semibold text-emerald-600">● {zone.status === 'active' ? 'Active' : 'Inactive'}</p></div><div className="flex gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-brand-600 shadow-sm"><Icon icon={faPen} /></span><span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-slate-500 shadow-sm"><Icon icon={faEye} /></span></div></div><p className="mt-6 border-b border-slate-200 pb-4 text-sm text-slate-500">{zone.managers} managers · {zone.drivers} livreurs · {zone.landmarks.length} points de repère</p><div className="flex items-center justify-between pt-4"><span className="text-sm text-slate-400">Frais de livraison</span><strong className="text-2xl text-[#9c4d0a]">{formatFCFA(zone.deliveryFee)}</strong></div></button>;
}

export function ManagerZonesPage() {
  const { data: zones = [], isLoading } = useListZonesQuery();
  const [selectedId, setSelectedId] = useState('akpakpa');
  const [draft, setDraft] = useState({ name: '', deliveryFee: 0, managerName: '', description: '' });
  const [isNewZoneOpen, setIsNewZoneOpen] = useState(false);
  const [isAddingLandmark, setIsAddingLandmark] = useState(false);
  const [landmarkName, setLandmarkName] = useState('');
  const [newZone, setNewZone] = useState({ name: '', deliveryFee: 500, managerName: zoneManagers[0], description: '' });
  const [message, setMessage] = useState('');
  const [updateZone, { isLoading: isSaving }] = useUpdateZoneMutation();
  const [createZone, { isLoading: isCreating }] = useCreateZoneMutation();
  const [addLandmark, { isLoading: isAdding }] = useAddLandmarkMutation();
  const selectedZone = useMemo(() => zones.find((zone) => zone.id === selectedId) || zones[0], [selectedId, zones]);

  useEffect(() => {
    if (selectedZone) setDraft({ name: selectedZone.name, deliveryFee: selectedZone.deliveryFee, managerName: selectedZone.managerName, description: selectedZone.description });
  }, [selectedZone]);

  const announce = (text: string) => { setMessage(text); window.setTimeout(() => setMessage(''), 3200); };

  const saveChanges = async () => {
    if (!selectedZone) return;
    try {
      await updateZone({ id: selectedZone.id, changes: draft }).unwrap();
      announce('Les modifications de la zone ont été enregistrées.');
    } catch {
      announce('Impossible d’enregistrer cette zone.');
    }
  };

  const submitNewZone = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newZone.name.trim()) return;
    try {
      const created = await createZone({ ...newZone, name: newZone.name.trim() }).unwrap();
      setSelectedId(created.id);
      setIsNewZoneOpen(false);
      setNewZone({ name: '', deliveryFee: 500, managerName: zoneManagers[0], description: '' });
      announce('La nouvelle zone a été créée.');
    } catch {
      announce('Impossible de créer cette zone.');
    }
  };

  const submitLandmark = async () => {
    if (!selectedZone || !landmarkName.trim()) return;
    try {
      await addLandmark({ zoneId: selectedZone.id, name: landmarkName.trim() }).unwrap();
      setLandmarkName('');
      setIsAddingLandmark(false);
      announce('Le point de repère a été ajouté.');
    } catch {
      announce('Impossible d’ajouter ce point de repère.');
    }
  };

  return (
    <div className="min-h-screen bg-black text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[294px] flex-col bg-[#111727] p-5 text-white lg:flex"><div className="px-5 pt-14 text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">Zone Manager</div><div className="mt-auto border-t border-white/10 pt-6"><Link to="/manager" className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 transition hover:text-white"><Icon icon={faGear} /> Paramètres</Link><div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-orange-600 font-black">MK</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">Marc Koffi</p><p className="text-xs text-slate-400">Administrateur</p></div><Icon icon={faRightFromBracket} className="text-slate-400" /></div></div></aside>
      <div className="min-h-screen lg:pl-[294px]"><header className="flex min-h-[78px] items-center justify-between gap-4 bg-white px-5 sm:px-8"><h1 className="text-2xl font-black tracking-tight sm:text-3xl">Gestion des zones</h1><div className="flex items-center gap-3"><button type="button" onClick={() => setIsNewZoneOpen(true)} className="btn-primary rounded-xl bg-[#ad520b] px-5 py-3 hover:bg-[#8d4108]"><Icon icon={faPlus} className="mr-2" /> Nouvelle zone</button><span className="mx-2 hidden h-8 w-px bg-slate-200 sm:block" /><button type="button" className="grid h-11 w-11 place-items-center text-slate-500 hover:text-brand-600" aria-label="Notifications"><Icon icon={faBell} /></button><span className="grid h-10 w-10 place-items-center rounded-full bg-slate-800 text-xs font-bold text-white">MK</span></div></header><main className="px-5 py-7 sm:px-8"><div className="mx-auto max-w-[1300px] grid gap-6 xl:grid-cols-[470px_minmax(0,1fr)]"><section><div className="mb-4 flex items-center justify-between text-xs font-bold uppercase tracking-[0.15em] text-slate-400"><span>Liste des zones actives</span><span className="text-orange-500">{zones.length} zones au total</span></div><div className="space-y-4">{isLoading && [1, 2, 3].map((item) => <div key={item} className="h-48 animate-pulse rounded-2xl bg-white/90" />)}{!isLoading && zones.map((zone) => <ZoneCard key={zone.id} zone={zone} selected={zone.id === selectedZone?.id} onSelect={() => setSelectedId(zone.id)} />)}</div></section><section className="min-w-0 space-y-6">{selectedZone && <><ZoneMap zones={zones} selectedId={selectedZone.id} /><div className="rounded-3xl bg-white p-6 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-black">Points de repère — Zone {selectedZone.name}</h2><button type="button" onClick={() => setIsAddingLandmark((current) => !current)} className="inline-flex items-center gap-2 font-semibold text-[#9c4d0a]"><Icon icon={faPlus} /> Ajouter</button></div>{isAddingLandmark && <div className="mt-5 flex flex-col gap-2 rounded-2xl bg-orange-50 p-4 sm:flex-row"><input value={landmarkName} onChange={(event) => setLandmarkName(event.target.value)} placeholder="Nom du point de repère" className="field-input mt-0 flex-1" /><button type="button" onClick={() => void submitLandmark()} disabled={isAdding || !landmarkName.trim()} className="btn-primary bg-[#ad520b] hover:bg-[#8d4108]">{isAdding ? 'Ajout…' : 'Ajouter'}</button></div>}<div className="mt-5 flex flex-wrap gap-3">{selectedZone.landmarks.slice(0, 4).map((landmark) => <span key={landmark.id} className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-[#fff8f2] px-4 py-2 text-sm font-semibold text-[#a35a29]"><Icon icon={faLocationDot} />{landmark.name}</span>)}{selectedZone.landmarks.length > 4 && <span className="inline-flex items-center rounded-full border border-dashed border-orange-300 bg-orange-50 px-4 py-2 text-sm font-semibold text-slate-500">+ {selectedZone.landmarks.length - 4} autres</span>}</div></div><div className="rounded-3xl bg-white p-6 shadow-sm sm:p-8"><h2 className="text-xl font-black">Détails de la zone</h2><div className="mt-7 grid gap-5 sm:grid-cols-2"><label className="field-label">Nom de la zone<input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} className="field-input" /></label><label className="field-label">Frais de livraison (FCFA)<div className="relative"><input value={draft.deliveryFee} onChange={(event) => setDraft((current) => ({ ...current, deliveryFee: Number(event.target.value) }))} type="number" min="0" className="field-input pr-16" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">FCFA</span></div></label><label className="field-label sm:col-span-2">Manager responsable<div className="relative"><select value={draft.managerName} onChange={(event) => setDraft((current) => ({ ...current, managerName: event.target.value }))} className="field-input appearance-none pr-10">{zoneManagers.map((manager) => <option key={manager}>{manager}</option>)}</select><Icon icon={faChevronDown} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" /></div></label><label className="field-label sm:col-span-2">Description<textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} className="field-input min-h-32 resize-y" /></label></div><div className="mt-8 flex flex-col-reverse justify-end gap-3 sm:flex-row sm:items-center"><button type="button" onClick={() => selectedZone && setDraft({ name: selectedZone.name, deliveryFee: selectedZone.deliveryFee, managerName: selectedZone.managerName, description: selectedZone.description })} className="px-4 py-3 font-semibold text-slate-500 hover:text-slate-800">Réinitialiser</button><button type="button" onClick={() => void saveChanges()} disabled={isSaving} className="btn-primary bg-[#ad520b] px-5 hover:bg-[#8d4108]"><Icon icon={faFloppyDisk} className="mr-2" />{isSaving ? 'Enregistrement…' : 'Enregistrer les modifications'}</button></div></div></>}</section></div></main></div>
      {isNewZoneOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 px-5 py-8"><form onSubmit={(event) => void submitNewZone(event)} className="motion-enter w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Configuration opérationnelle</p><h2 className="mt-2 text-2xl font-black">Nouvelle zone</h2><p className="mt-2 text-sm text-slate-500">Créez une zone et affectez son responsable.</p></div><button type="button" onClick={() => setIsNewZoneOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-500"><Icon icon={faXmark} /></button></div><div className="mt-7 grid gap-5 sm:grid-cols-2"><label className="field-label sm:col-span-2">Nom de la zone<input value={newZone.name} onChange={(event) => setNewZone((current) => ({ ...current, name: event.target.value }))} placeholder="Ex: Zogbo" className="field-input" autoFocus /></label><label className="field-label">Frais de livraison<input value={newZone.deliveryFee} onChange={(event) => setNewZone((current) => ({ ...current, deliveryFee: Number(event.target.value) }))} type="number" min="0" className="field-input" /></label><label className="field-label">Manager responsable<select value={newZone.managerName} onChange={(event) => setNewZone((current) => ({ ...current, managerName: event.target.value }))} className="field-input">{zoneManagers.map((manager) => <option key={manager}>{manager}</option>)}</select></label><label className="field-label sm:col-span-2">Description<textarea value={newZone.description} onChange={(event) => setNewZone((current) => ({ ...current, description: event.target.value }))} placeholder="Décrivez la zone, ses accès et ses contraintes…" className="field-input min-h-28 resize-y" /></label></div><div className="mt-7 flex justify-end gap-3"><button type="button" onClick={() => setIsNewZoneOpen(false)} className="btn-secondary !bg-white">Annuler</button><button type="submit" disabled={isCreating || !newZone.name.trim()} className="btn-primary bg-[#ad520b] hover:bg-[#8d4108]">{isCreating ? 'Création…' : 'Créer la zone'}</button></div></form></div>}
      {message && <div role="status" className="motion-enter fixed bottom-5 right-5 z-[60] rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-xl">{message}</div>}
    </div>
  );
}

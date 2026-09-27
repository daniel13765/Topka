import { useState } from 'react';
import toast from 'react-hot-toast';
import MIcon from '../../shared/MIcon';
import { useLanguage } from '../../../context/LanguageContext';
import { tx } from '../../../i18n/tx';


interface ProfileData {
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  ville: string;
  quartier: string;
}

/**
 * ProfileHeader — En-tête de profil utilisateur (avatar, nom, statut vérifié, édition).
 */
export default function ProfileHeader() {
  const { t, isFr } = useLanguage();
  const [user, setUser] = useState<ProfileData>({
    prenom: 'Kossi',
    nom: 'Ouédraogo',
    email: 'kossi.ouedraogo@tokpa.bj',
    telephone: '+229 97 00 11 22',
    ville: 'Cotonou',
    quartier: 'Cadjehoun',
  });

  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<ProfileData>(user);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setUser(form);
    setEditOpen(false);
    toast.success(isFr ? tx("Profil mis à jour avec succès") : 'Profile updated successfully');
  };

  const initials = `${user.prenom[0] ?? ''}${user.nom[0] ?? ''}`.toUpperCase();

  return (
    <>
      <section className="mb-md flex flex-col justify-between gap-md rounded-[14px] border border-line bg-white p-4 sm:p-lg sm:flex-row sm:items-center">
        <div className="flex items-center gap-md">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-lighter text-[20px] font-bold text-primary-dark sm:h-16 sm:w-16 sm:text-[22px]">
            {initials}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-h2 text-lg font-bold text-ink sm:text-h2">
                {user.prenom} {user.nom}
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-success-light px-2.5 py-0.5 text-micro font-bold uppercase tracking-wider text-success-dark">
                <MIcon name="verified_user" className="!text-[14px]" />
                {t('profile.verifiedClient')}
              </span>
            </div>
            <div className="mt-1 flex items-center text-ink-2">
              <MIcon name="location_on" className="mr-1 text-sm text-primary" />
              <span className="text-xs font-medium sm:text-sm">
                {user.ville} · {user.quartier}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setForm(user);
            setEditOpen(true);
          }}
          className="scale-interaction flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-xs font-bold text-ink-2 transition-colors hover:bg-surface hover:text-ink sm:text-sm"
        >
          <MIcon name="edit" className="text-sm" />
          {t('profile.editProfile')}
        </button>
      </section>

      {/* Modal de modification de profil */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-[500px] rounded-2xl bg-white p-lg shadow-xl">
            <div className="mb-md flex items-center justify-between border-b border-line pb-sm">
              <h3 className="font-h2 text-h2 text-ink">{t('profile.editProfile')}</h3>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="rounded-full p-2 text-ink-2 hover:bg-page"
              >
                <MIcon name="close" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{isFr ? tx("Prénom") : 'First Name'}</label>
                  <input
                    type="text"
                    value={form.prenom}
                    onChange={(e) => setForm({ ...form, prenom: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label">{isFr ? 'Nom' : 'Last Name'}</label>
                  <input
                    type="text"
                    value={form.nom}
                    onChange={(e) => setForm({ ...form, nom: e.target.value })}
                    className="input"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="label">{isFr ? tx("Téléphone") : 'Phone'}</label>
                <input
                  type="tel"
                  value={form.telephone}
                  onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{isFr ? tx("Ville") : 'City'}</label>
                  <input
                    type="text"
                    value={form.ville}
                    onChange={(e) => setForm({ ...form, ville: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label">{isFr ? tx("Quartier") : 'Neighborhood'}</label>
                  <input
                    type="text"
                    value={form.quartier}
                    onChange={(e) => setForm({ ...form, quartier: e.target.value })}
                    className="input"
                    required
                  />
                </div>
              </div>

              <div className="mt-lg flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="w-1/2 rounded-lg border border-line py-2.5 text-xs font-bold text-ink-2"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="w-1/2 rounded-lg bg-primary py-2.5 text-xs font-bold text-white shadow-sm"
                >
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

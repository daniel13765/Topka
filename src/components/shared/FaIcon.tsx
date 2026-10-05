import type { FontAwesomeIconProps } from '@fortawesome/react-fontawesome';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleQuestion } from '@fortawesome/free-solid-svg-icons';
import { ICONES_MATERIAL } from './faIcones';

/**
 * Icônes Font Awesome utilisées par TOKPa.
 *
 * Tous les écrans de l'application rendent leurs icônes par ce composant : la police Material
 * Symbols du design exporté n'est plus embarquée, les ligatures de la maquette ne servent que de
 * clés d'entrée dans la table `ICONES_MATERIAL` (voir `./faIcones`).
 */

/** Nom de ligature hérité de la maquette ; un nom hors table affiche un point d'interrogation visible. */
export default function FaIcon({
  name,
  className,
  style,
  title,
}: {
  name: string;
  className?: string;
  style?: FontAwesomeIconProps['style'];
  title?: string;
}) {
  return (
    <FontAwesomeIcon
      icon={ICONES_MATERIAL[name] ?? faCircleQuestion}
      className={className}
      style={style}
      title={title}
      aria-hidden={title ? undefined : true}
    />
  );
}

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { SizeProp } from '@fortawesome/fontawesome-svg-core';

interface IconProps {
  icon: IconDefinition;
  size?: SizeProp;
  className?: string;
  title?: string;
}

export function Icon({ icon, size, className, title }: IconProps) {
  return <FontAwesomeIcon icon={icon} size={size} className={className} title={title} aria-hidden={title ? undefined : true} />;
}

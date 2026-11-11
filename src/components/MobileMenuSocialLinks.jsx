import { useLang } from '../i18n/index.js';
import { MOBILE_MENU_SOCIAL_PROFILES } from '../navigation/socialProfiles.js';

// Identical social markup and real URLs for the home static drawer and the
// Works dialog. The host chooses how external-link confirmation is handled.
export default function MobileMenuSocialLinks({ onExternalClick }) {
  const lang = useLang();
  return <div className="mobile-menu__social">
    <p className="mobile-menu__social-label">{lang === 'en' ? 'Social' : '社交平台'}</p>
    <div className="mobile-menu__social-list">
      {MOBILE_MENU_SOCIAL_PROFILES.map(profile => <a key={profile.id} href={profile.href}
        target="_blank" rel="noopener noreferrer"
        data-external-label-zh={`${profile.zh}主页`} data-external-label-en={`${profile.en} profile`}
        onClick={onExternalClick ? event => onExternalClick(event, profile) : undefined}>
        {profile[lang]}
      </a>)}
    </div>
  </div>;
}

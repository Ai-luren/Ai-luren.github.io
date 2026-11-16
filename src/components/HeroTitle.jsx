import TextType from './TextType.jsx';
import { useLang } from '../i18n/index.js';
import './HeroTitle.css';

const ROTATING_WORDS = {
  zh: ['视频设计', '图像设计', '氛围编程'],
  en: ['Video Design', 'Image Design', 'Vibe Coding'],
};

export default function HeroTitle() {
  const lang = useLang();

  // First paint must remain stable: the previous useEffect ran after the
  // full headline appeared, then forced it to opacity 0 and faded it back in.
  // TextType still handles subsequent rotating role labels independently.

  return (
    <h1 id="hero-title" className="hero-title">
      <span className="hero-title__prefix">{lang === 'en' ? 'AI Creative' : 'AI 创意'}</span>
      <TextType
        key={lang}
        as="span"
        className="hero-title__rotating"
        text={ROTATING_WORDS[lang]}
        startWithFullText
        typingSpeed={lang === 'en' ? 50 : 90}
        deletingSpeed={lang === 'en' ? 30 : 50}
        pauseDuration={1600}
        initialDelay={200}
        showCursor
        cursorCharacter=""
      />
    </h1>
  );
}

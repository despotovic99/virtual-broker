import { Card, Notice, Page, Segmented } from '../../ui/components.tsx'
import { Icon, type IconName } from '../../ui/icons.tsx'
import { useI18n, type Language } from '../i18n/I18nContext.tsx'
import { useTheme, type ThemePreference } from '../theme/ThemeContext.tsx'

const THEMES: { value: ThemePreference; icon: IconName }[] = [
  { value: 'system', icon: 'monitor' },
  { value: 'light', icon: 'sun' },
  { value: 'dark', icon: 'moon' },
]

/** Lična podešavanja prikaza: tema i jezik. Važe za ovaj pregledač. */
export function SettingsPage() {
  const { t, language, setLanguage } = useI18n()
  const { preference, theme, setPreference } = useTheme()

  return (
    <Page title={t('settings.title')}>
      <div className="stack settings">
        <Card title={t('settings.appearance')}>
          <fieldset className="choices">
            <legend>{t('settings.theme')}</legend>
            {THEMES.map((option) => {
              const previewTheme = option.value === 'system' ? theme : option.value
              return (
                <label key={option.value} className="choice">
                  <input
                    type="radio"
                    name="theme"
                    value={option.value}
                    checked={preference === option.value}
                    onChange={() => setPreference(option.value)}
                  />
                  <span className={`theme-preview theme-preview--${previewTheme}`} aria-hidden="true">
                    <span className="theme-preview__bar" />
                    <span className="theme-preview__card">
                      <span className="theme-preview__line" />
                      <span className="theme-preview__chip" />
                    </span>
                  </span>
                  <span className="choice__text">
                    <span className="choice__title">
                      <Icon name={option.icon} size={15} />
                      {t(`settings.theme.${option.value}`)}
                    </span>
                    <span className="choice__hint">
                      {option.value === 'system'
                        ? t('settings.theme.systemHint', { current: t(`settings.current.${theme}`) })
                        : t(`settings.theme.${option.value}Hint`)}
                    </span>
                  </span>
                </label>
              )
            })}
          </fieldset>
          <Notice tone="plain">{t('settings.print')}</Notice>
        </Card>

        <Card title={t('settings.language')}>
          <div className="stack stack--sm">
            <Segmented<Language>
              label={t('settings.language')}
              value={language}
              onChange={setLanguage}
              options={[
                { value: 'sr', label: 'Srpski' },
                { value: 'en', label: 'English' },
              ]}
            />
            <span className="field-hint">{t('settings.languageHint')}</span>
          </div>
        </Card>

        <p className="muted">{t('settings.stored')}</p>
      </div>
    </Page>
  )
}

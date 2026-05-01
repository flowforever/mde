import {
  BUILT_IN_APP_LANGUAGE_PACKS,
  createAppText,
  type AppText,
} from '../i18n/appLanguage'

interface ShellProps {
  readonly text?: AppText
}

export const Shell = ({
  text = createAppText(BUILT_IN_APP_LANGUAGE_PACKS.en),
}: ShellProps): React.JSX.Element => (
  <main className="app-shell">
    <aside className="explorer-pane" aria-label={text('explorer.header')}>
      <div className="explorer-header">{text('explorer.header')}</div>
      <button className="workspace-manager-button workspace-item-button" type="button">
        <span>{text('workspace.openWorkspace')}</span>
      </button>
    </aside>
    <section className="editor-pane" aria-label={text('editor.label')}>
      <div className="editor-empty-state">
        <p className="editor-kicker">MDE</p>
        <h1>{text('editor.emptyTitle')}</h1>
      </div>
    </section>
  </main>
)

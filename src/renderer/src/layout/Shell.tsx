export const Shell = (): React.JSX.Element => (
  <main className="app-shell">
    <aside className="explorer-pane" aria-label="Explorer">
      <div className="explorer-header">Explorer</div>
      <button className="workspace-manager-button workspace-item-button" type="button">
        <span>Open workspace</span>
      </button>
    </aside>
    <section className="editor-pane" aria-label="Editor">
      <div className="editor-empty-state">
        <p className="editor-kicker">MDE</p>
        <h1>Select a folder to begin</h1>
      </div>
    </section>
  </main>
)

export const Shell = (): React.JSX.Element => (
  <main className="app-shell">
    <aside className="explorer-pane" aria-label="Explorer">
      <div className="explorer-header">Explorer</div>
      <button className="open-folder-button" type="button">
        Open Folder
      </button>
    </aside>
    <section className="editor-pane" aria-label="Editor">
      <div className="editor-empty-state">
        <p className="editor-kicker">Markdown Editor</p>
        <h1>Select a folder to begin</h1>
      </div>
    </section>
  </main>
)

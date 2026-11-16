export default function NotFound() {
  return (
    <div className="wrap page">
      <p className="kicker">墨本</p>
      <h1>这篇不在匣子里</h1>
      <p className="intro">它可能还没通过审核，或者地址写错了。</p>
      <p>
        <a className="btn solid" href="/browse">
          回书库
        </a>
      </p>
    </div>
  );
}

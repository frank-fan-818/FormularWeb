import './SiteCredit.css';

const SiteCredit = () => (
  <small className="site-credit">
    © {new Date().getFullYear()} FrankFan <span aria-hidden="true">·</span> Built by FrankFan
  </small>
);

export default SiteCredit;

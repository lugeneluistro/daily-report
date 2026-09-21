// Self-hosted (bundled, no network at runtime) monospace face for the numbers — see .nb-num.
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import './NightBackground.css';
import './NightBackground.generated.css';

/** Animated deep-blue network background behind the page. Pure CSS — see NightBackground.css. */
const NightBackground = () => (
    <div className="nb-bg" aria-hidden="true">
        <span className="nb-glow nb-glow-a" />
        <span className="nb-glow nb-glow-b" />
        <span className="nb-glow nb-glow-c" />
        <span className="nb-glow nb-glow-d" />
        <span className="nb-net nb-net-far" />
        <span className="nb-net nb-net-near" />
        <span className="nb-bokeh nb-bokeh-a" />
        <span className="nb-bokeh nb-bokeh-b" />
        <span className="nb-stars nb-stars-sm" />
        <span className="nb-stars nb-stars-lg" />
    </div>
);

export default NightBackground;

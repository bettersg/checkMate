const withMT = require("@material-tailwind/react/utils/withMT");
 
module.exports = withMT({
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      gridTemplateColumns: {
        sidebar: "1fr auto", //for sidebar layout
        "sidebar-collapsed": "0.25fr auto", //for collapsed sidebar layout
      },
      colors: {
        'background-color': '#ffffff',
        'primary-color': '#ff8932',
        'primary-color2': '#cc3502',
        'primary-color3': '#82080c',
        'highlight-color': '#00a8b1',
        'secondary-color': '#ffd81b',
        'secondary-color2': '#ffbb0b',
        'success-color': '#d0ffc5',
        'pending-color': '#fff485',
        'error-color': '#ffc7a5',
      },
    },
  },
  plugins: [],
});


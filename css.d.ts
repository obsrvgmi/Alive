declare module "*.css" {
  const content: { [className: string]: string };
  export default content;
}

declare module "@rainbow-me/rainbowkit/styles.css";

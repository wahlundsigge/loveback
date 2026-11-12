import { Image } from "react-native";

const SVG = `<svg height="800px" width="800px" version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" xml:space="preserve"><g><polygon fill="#C9A84C" points="386.415,193.208 287.481,193.208 359.434,0 161.566,0 125.585,280.151 206.528,280.151 170.557,512"/></g></svg>`;

const URI = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(SVG)}`;

export function BoostIcon({ size = 22, color }: { size?: number; color?: string }) {
  const uri = color
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(SVG.replace(/fill="[^"]*"/, `fill="${color}"`))}`
    : URI;
  return (
    <Image source={{ uri }} style={{ width: size * 0.6, height: size }} resizeMode="contain" />
  );
}

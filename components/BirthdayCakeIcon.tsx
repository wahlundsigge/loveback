import { Image } from "react-native";

const SVG = `<svg width="800px" height="800px" viewBox="0 -2.19 47.336 47.336" xmlns="http://www.w3.org/2000/svg"><g transform="translate(-66.66 -364.396)"><path d="M4.351,0H40.984a4.351,4.351,0,0,1,4.351,4.351V22.117a1,1,0,0,1-1,1H1a1,1,0,0,1-1-1V4.351A4.351,4.351,0,0,1,4.351,0Z" transform="translate(67.66 383.243)" fill="none" stroke="#C9A84C" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/><path d="M113,389.249a3.778,3.778,0,0,1-3.778,3.778h0a3.779,3.779,0,0,1-3.778-3.778,3.778,3.778,0,0,1-3.778,3.778h0a3.779,3.779,0,0,1-3.778-3.778,3.778,3.778,0,0,1-3.778,3.778h0a3.779,3.779,0,0,1-3.778-3.778,3.778,3.778,0,0,1-3.778,3.778h0a3.779,3.779,0,0,1-3.778-3.778,3.778,3.778,0,0,1-3.778,3.778h0a3.778,3.778,0,0,1-3.777-3.778,3.779,3.779,0,0,1-3.778,3.778h0a3.778,3.778,0,0,1-3.778-3.778" fill="none" stroke="#C9A84C" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/><g><rect width="4.333" height="9.73" transform="translate(87.931 373.513)" fill="none" stroke="#C9A84C" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/><path d="M92.825,370.333a2.727,2.727,0,1,1-5.455,0c0-1.506,2.727-4.937,2.727-4.937S92.825,368.827,92.825,370.333Z" fill="none" stroke="#C9A84C" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></g></g></svg>`;

const URI = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(SVG)}`;

export function BirthdayCakeIcon({ size = 64 }: { size?: number }) {
  return (
    <Image source={{ uri: URI }} style={{ width: size, height: size }} resizeMode="contain" />
  );
}

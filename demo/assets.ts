import { Asset } from "expo-asset";

/**
 * Local demo photos (assets/demo/). The app renders photos as `{ uri }`
 * strings everywhere, so each bundled asset is resolved to its URI once here.
 * Sources and licence: see assets/demo/README.md.
 */
const uri = (mod: number): string => Asset.fromModule(mod).uri;

export const PEOPLE = {
  alex: uri(require("../assets/demo/people/alex.jpg")),
  elsa: uri(require("../assets/demo/people/elsa.jpg")),
  maja: uri(require("../assets/demo/people/maja.jpg")),
  saga: uri(require("../assets/demo/people/saga.jpg")),
  nora: uri(require("../assets/demo/people/nora.jpg")),
  alva: uri(require("../assets/demo/people/alva.jpg")),
  ines: uri(require("../assets/demo/people/ines.jpg")),
  liv: uri(require("../assets/demo/people/liv.jpg")),
  freja: uri(require("../assets/demo/people/freja.jpg")),
  wilma: uri(require("../assets/demo/people/wilma.jpg")),
  klara: uri(require("../assets/demo/people/klara.jpg")),
  ebba: uri(require("../assets/demo/people/ebba.jpg")),
  linnea: uri(require("../assets/demo/people/linnea.jpg")),
  hugo: uri(require("../assets/demo/people/hugo.jpg")),
  tuva: uri(require("../assets/demo/people/tuva.jpg")),
  stella: uri(require("../assets/demo/people/stella.jpg")),
  leo: uri(require("../assets/demo/people/leo.jpg")),
  noah: uri(require("../assets/demo/people/noah.jpg")),
  adam: uri(require("../assets/demo/people/adam.jpg")),
  elias: uri(require("../assets/demo/people/elias.jpg")),
  theo: uri(require("../assets/demo/people/theo.jpg")),
};

export const LIFE = {
  coffee: uri(require("../assets/demo/life/coffee.jpg")),
  mountains: uri(require("../assets/demo/life/mountains.jpg")),
  lake: uri(require("../assets/demo/life/lake.jpg")),
  food: uri(require("../assets/demo/life/food.jpg")),
  paint: uri(require("../assets/demo/life/paint.jpg")),
  concert: uri(require("../assets/demo/life/concert.jpg")),
  dog: uri(require("../assets/demo/life/dog.jpg")),
  music: uri(require("../assets/demo/life/music.jpg")),
  beach: uri(require("../assets/demo/life/beach.jpg")),
  hiking: uri(require("../assets/demo/life/hiking.jpg")),
  forest: uri(require("../assets/demo/life/forest.jpg")),
  boat: uri(require("../assets/demo/life/boat.jpg")),
};

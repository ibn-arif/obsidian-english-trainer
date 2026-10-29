const EN_POS: Record<string, string> = {
  noun: "существительное",
  verb: "глагол",
  adjective: "прилагательное",
  adverb: "наречие",
  pronoun: "местоимение",
  preposition: "предлог",
  conjunction: "союз",
  interjection: "междометие",
};

export function posFromEnglish(pos: string | undefined): string {
  return pos ? EN_POS[pos.toLowerCase()] ?? pos : "";
}

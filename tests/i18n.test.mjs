import test from "node:test";
import assert from "node:assert/strict";
import { translate } from "../src/lib/i18n.tsx";

test("translates common interface labels", () => {
  assert.equal(translate("Settings", "es"), "Ajustes");
  assert.equal(translate("Settings", "fr"), "Paramètres");
});

test("falls back to the original text", () => {
  assert.equal(translate("Caleb's squad", "fr"), "Caleb's squad");
});

test("can return to English from another locale", () => {
  assert.equal(translate("Ajustes", "en"), "Settings");
  assert.equal(translate("Paramètres", "en"), "Settings");
});
import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateAt, removeAt, move } from "./array-helpers";

describe("updateAt", () => {
  it("replaces the item at that index", () => {
    const skills = ["Python", "Java", "Go"];

    const result = updateAt(skills, 1, "TypeScript");

    expect(result).toEqual(["Python", "TypeScript", "Go"]);
  });

  it("does not change the original array", () => {
    const skills = ["Python", "Java", "Go"];

    updateAt(skills, 1, "TypeScript");

    expect(skills).toEqual(["Python", "Java", "Go"]);
  });
});

describe("removeAt", () => {
  it("removes the item at that index", () => {
    const skills = ["Python", "Java", "Go"];

    const result = removeAt(skills, 1);

    expect(result).toEqual(["Python", "Go"]);
  });
});

describe("move", () => {
  it("moves an entry up (masters above bachelors)", () => {
    const education = ["Bachelors", "Masters", "Certificate"];

    const result = move(education, 1, 0);

    expect(result).toEqual(["Masters", "Bachelors", "Certificate"]);
  });

  it("moves an entry down", () => {
    const sections = ["Education", "Experience", "Skills"];

    const result = move(sections, 0, 1);

    expect(result).toEqual(["Experience", "Education", "Skills"]);
  });

  it("does not change the original array", () => {
    const education = ["Bachelors", "Masters"];

    move(education, 1, 0);

    expect(education).toEqual(["Bachelors", "Masters"]);
  });

  it("returns the array unchanged when the target index is out of bounds", () => {
    const education = ["Bachelors", "Masters"];

    expect(move(education, 0, -1)).toBe(education);
    expect(move(education, 1, 2)).toBe(education);
  });
});

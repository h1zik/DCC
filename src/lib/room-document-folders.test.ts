import { describe, expect, it } from "vitest";
import {
  flattenFoldersForPicker,
  getDescendantFolderIds,
  type RoomFolderNode,
} from "./room-document-folders";

const folders: RoomFolderNode[] = [
  { id: "a", name: "A", parentId: null, sortOrder: 0 },
  { id: "b", name: "B", parentId: "a", sortOrder: 0 },
  { id: "c", name: "C", parentId: "b", sortOrder: 0 },
  { id: "d", name: "D", parentId: "a", sortOrder: 1 },
  { id: "e", name: "E", parentId: null, sortOrder: 1 },
];

describe("getDescendantFolderIds", () => {
  it("mengembalikan seluruh anak langsung dan turunan terdalam", () => {
    expect([...getDescendantFolderIds(folders, "a")].sort()).toEqual([
      "b",
      "c",
      "d",
    ]);
  });

  it("tidak memasukkan folder asal dan aman untuk folder tanpa anak", () => {
    expect([...getDescendantFolderIds(folders, "c")]).toEqual([]);
  });
});

describe("folder move picker", () => {
  it("dapat menyembunyikan folder asal beserta seluruh turunannya", () => {
    const excluded = getDescendantFolderIds(folders, "a");
    excluded.add("a");

    expect(
      flattenFoldersForPicker(
        folders.filter((folder) => !excluded.has(folder.id)),
      ),
    ).toEqual([{ id: "e", label: "E", depth: 0 }]);
  });
});

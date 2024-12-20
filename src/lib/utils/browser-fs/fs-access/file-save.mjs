/**
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// @license © 2020 Google LLC. Licensed under the Apache License, Version 2.0.

/**
 * Saves a file to disk using the File System Access API.
 * @type { typeof import("../../index").fileSave }
 */
export default async (
  blob,
  options = [{}],
  existingHandle = null,
  throwIfExistingHandleNotGood = false
) => {
  if (!Array.isArray(options)) {
    options = [options];
  }
  options[0].fileName = options[0].fileName || 'Untitled';
  const types = [];
  options.forEach((option, i) => {
    types[i] = {
      description: option.description || '',
      accept: {},
    };
    if (option.mimeTypes) {
      if (i === 0) {
        option.mimeTypes.push(blob.type);
      }
      option.mimeTypes.map((mimeType) => {
        types[i].accept[mimeType] = option.extensions || [];
      });
    } else {
      types[i].accept[blob.type] = option.extensions || [];
    }
  });
  if (existingHandle) {
    try {
      // Check if the file still exists.
      await existingHandle.getFile();
    } catch (err) {
      existingHandle = null;
      if (throwIfExistingHandleNotGood) {
        throw err;
      }
    }
  }
  const handle =
    existingHandle ||
    (await window.showSaveFilePicker({
      suggestedName: options[0].fileName,
      id: options[0].id,
      startIn: options[0].startIn,
      types,
      excludeAcceptAllOption: options[0].excludeAcceptAllOption || false,
    }));
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
  return handle;
};

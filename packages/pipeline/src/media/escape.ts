/**
 * Escaping for ffmpeg's own mini-languages. Arguments reach ffmpeg without a shell (no shell
 * quoting needed), but a value inside a filtergraph is parsed twice by ffmpeg itself:
 *   1. the filtergraph parser splits filters on , ; [ ] and unescapes \ and '
 *   2. each filter's option parser splits options on : and unescapes \ and ' again
 * So a path used as a filter option (movie=, amovie=, subtitles=, fontfile=) needs both levels.
 * Windows paths are the classic trap: the drive colon would end the option.
 */

/** Level 2 only: a value for one filter option (the part after `key=`). */
export const escapeFilterOption = (value: string): string => value.replace(/[\\':]/g, (c) => `\\${c}`);

/** Level 1 only: protect a filter description inside a filtergraph. */
export const escapeFilterGraph = (desc: string): string => desc.replace(/[\\'[\],;]/g, (c) => `\\${c}`);

/** Both levels, for a filter option value placed directly in a -vf / -af / -filter_complex string. */
export const filterValue = (value: string): string => escapeFilterGraph(escapeFilterOption(value));

/** A file path for a filter option. Backslashes become slashes first: ffmpeg accepts them on Windows. */
export const filterPath = (path: string): string => filterValue(path.replace(/\\/g, '/'));

/** One line of a concat-demuxer list: file '<path>' with single quotes escaped the concat way. */
export const concatLine = (path: string): string => `file '${path.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`;

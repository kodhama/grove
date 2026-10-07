#!/usr/bin/env bash
# read-input-line.sh — say whether a pane's input line holds unsent text.
#
# herdr submits whatever sits unsent in a pane's input line together with the
# next prompt it types, so a /clear typed over a draft arrives as plain text
# and clears nothing (MQ-359's probe, 2026-09-29). Both the restart helper and
# the report relay read the input line before they type.
#
# The input line is the text between the last two rules (─) of the screen
# Claude Code draws, less its ❯ prompt and any dim text: in an empty box,
# as right after a clear, Claude Code draws a suggested prompt dim (SGR 2),
# while typed text is plain. So the screen is read with its ANSI styling
# (MQ-359's AE6 run, 2026-09-29). A dim span ends at an SGR that resets it
# (0, 22 or a bare ESC[m, alone or compound); one its line never closes, or
# one holding a pasted-text or image chip, is a draft. So is a box line
# after the first that is blank or holds plain text: a draft with newlines.
# A box that does not open on its prompt, as when a draft holds a pasted rule
# line or a dialog is open, is ambiguous. A screen with no such box, an
# ambiguous one, or a pane herdr cannot read, is unreadable, and unreadable is
# never clear to type into: a layout change fails closed, as a report, never
# as a typed /clear.
#
# Prints one word, empty, draft or unreadable. Exit status: 0 empty; 1 draft
# or unreadable; 2 bad arguments.

set -u
if [ $# -ne 3 ]; then
  echo "Usage: read-input-line.sh <herdr-binary> <pane-id> <timeout-seconds>" >&2
  exit 2
fi
herdr="$1" pane="$2" secs="$3"

screen=$(perl -MTime::HiRes=alarm -e 'alarm shift; exec @ARGV or exit 127' "$secs" \
  "$herdr" agent read "$pane" --source visible --format ansi 2>/dev/null) || { echo unreadable; exit 1; }

state=$(printf '%s\n' "$screen" | perl -CSD -ne '
  chomp; s/\r//g;
  my ($plain, $dimmed, $dim) = ("", "", 0);
  while (length) {
    if (s/^\e\[([0-9;]*)m//) {
      my @p = split /;/, $1, -1;
      @p = (0) unless @p;
      while (@p) {
        my $n = shift(@p) || 0;
        # 38, 48 and 58 take a colour: 5;<n> or 2;<r>;<g>;<b>, never a dim 2.
        if ($n == 38 || $n == 48 || $n == 58) { my $m = shift(@p) // ""; splice @p, 0, $m eq "5" ? 1 : $m eq "2" ? 3 : 0 }
        elsif ($n == 0 || $n == 22) { $dim = 0 }
        elsif ($n == 2) { $dim = 1 }
      }
    } elsif (s/^\e\[[0-9;?]*[A-Za-z]//) {
    } elsif (s/^(.)//s) {
      if ($dim) { $dimmed .= $1 } else { $plain .= $1 }
    }
  }
  push @lines, { plain => $plain, dimmed => $dimmed, open => $dim };
  END {
    my @rules = grep { $lines[$_]{plain} =~ /^\s*\x{2500}{3,}/ } 0 .. $#lines;
    if (@rules < 2 || $rules[-1] - $rules[-2] < 2) { print "unreadable"; exit }
    my @box = @lines[$rules[-2] + 1 .. $rules[-1] - 1];
    # The box opens on its prompt; a pasted rule line or a dialog does not.
    unless ($box[0]{plain} =~ s/^\s*\x{276F}//) { print "unreadable"; exit }
    for my $i (0 .. $#box) {
      my $l = $box[$i];
      (my $text = $l->{plain}) =~ s/[\s\x{A0}]+//g;
      my $draft = $text ne "" || $l->{open}
        || $l->{dimmed} =~ /\[(?:Pasted text|Image) #\d+/
        || ($i > 0 && $l->{dimmed} !~ /\S/);
      if ($draft) { print "draft"; exit }
    }
    print "empty";
  }')
echo "${state:-unreadable}"
[ "$state" = empty ]

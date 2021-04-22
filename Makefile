# vim: set expandtab

# Build system for the www.bunsenlabs.org website
# Copyright (C) 2015-2021 Jens John <dev@2ion.de>
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.	See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program. If not, see <http://www.gnu.org/licenses/>.

include config/pages.mk
include config/variables.mk

SHELL                       = /bin/bash
TIMESTAMP                   = $(shell date +%Y%m%d%H%M)
REVISION                    = $(shell git rev-parse --short HEAD; git diff-index --quiet HEAD -- || echo -n +)
LOG_STATUS                  = @printf "\033[1;32m%*s\033[0m %s\n" 10 "$(1)" "$(2)"
DESTDIR                     = dst
SETTINGS                    = config/settings.yml

NAVIGATION_HTML             = include/navigation.html
STYLE                       = /css/plain.css?$(TIMESTAMP)
TEMPLATE                    = template.html
OPENGRAPH_URL_PREFIX        = https://www.bunsenlabs.org
OPENGRAPH_IMG               = img/opengraph-flame.png

FAVICON_HEADER              = include/favicons.html
FAVICON_SIZES               = 256 180 128
FAVICON_SOURCE              = src/img/bl-flame-48px.svg

GALLERY_HEADER              = include/index/gallery.html
GALLERY_INDEX               = src/gallery.json

DONATION_JSON               = dst/donations.json
DONATION_INTERMEDIATE       = src/donations.intermediate.mkd
DONATION_DATA               = config/donations.csv

TARGETS                     = $(patsubst %.mkd,%.html,$(wildcard src/*.mkd)) $(DONATION_JSON)
ASSETS                      = $(TARGETS) src/BunsenLabs-RELEASE.asc src/bundle src/js src/img src/css src/robots.txt src/bitcoinaddress.txt $(GALLERY_INDEX)

THUMB_DIM                   = x50
THUMB_DIR                   = src/img/frontpage-gallery/thumbs
THUMB_FULLSIZE_JPEG_QUALITY = 90
THUMB_JPEG_QUALITY          = 90
THUMB_OBJ                   = $(subst frontpage-gallery/,frontpage-gallery/thumbs/,$(patsubst %.png,%.thumb.jpg,$(wildcard src/img/frontpage-gallery/*.png)))

ARGV=                                                                                      \
	--css=$(STYLE)                                                                           \
	--email-obfuscation=javascript                                                           \
	--from=markdown+footnotes+fenced_code_attributes+auto_identifiers+definition_lists+smart \
	--highlight-style=monochrome                                                             \
	--include-before-body=$(NAVIGATION_HTML)                                                 \
	--include-in-header=$(FAVICON_HEADER)                                                    \
	--standalone                                                                             \
	--template=$(TEMPLATE)                                                                   \
	--toc

PANDOC_VARS=                                           \
	--metadata=filename="$(@F)"                          \
	--metadata=git-revision="$(REVISION)"                \
	--metadata=lang="en"                                 \
	--metadata=opengraph-description="$($<.description)" \
	--metadata=opengraph-image="$(OPENGRAPH_IMG)"        \
	--metadata=pagetitle="$($<.title)"                   \
	--metadata=url-prefix="$(OPENGRAPH_URL_PREFIX)"

###############################################################################

.PHONY:          \
	all            \
	build          \
	checkout       \
	clean          \
	deploy-kelaino \
	deploy-local   \
	deploy-static  \
	deploy-beta    \
	html-pages     \
	thumbnails     \
	serve

build: checkout
	$(call LOG_STATUS,BUILD)
	@mkdir -p -- "$(DESTDIR)/feeds"
	@./libexec/generate-feeds "$(DESTDIR)" "$(DESTDIR)/feeds/atom.xml" "$(DESTDIR)/feeds/rss.xml"

checkout: all $(DESTDIR)
	$(call LOG_STATUS,CHECKOUT)
	@rsync -auL --exclude='*intermediate*' $(ASSETS) $(DESTDIR)

all: html-pages thumbnails variables $(GALLERY_INDEX)

html-pages: $(TARGETS)

thumbnails: $(THUMB_DIR) $(THUMB_OBJ)

gallery-index: $(GALLERY_INDEX)

clean:
	$(call LOG_STATUS,CLEAN)
	@rm -f src/*.html src/img/frontpage-gallery/thumbs/* src/img/frontpage-gallery/*.jpg
	@rm -f src/img/installguide/*.jpg src/img/installguide/thumbs/*
	@rm -f src/img/favicon*.png
	@rm -f $(FAVICON_HEADER)
	@rm -f $(GALLERY_HEADER)
	@rm -f $(GALLERY_INDEX)
	@rm -fr dst/*

deploy-kelaino: build
	$(call LOG_STATUS,DEPLOY,KELAINO)
	@-rsync -au --progress --human-readable --delete --exclude=private --chmod=D0755,F0644 dst/ root@kelaino:/srv/kelaino.bunsenlabs.org/www/

deploy-static: build
	$(call LOG_STATUS,DEPLOY,$@)
	@-rsync -au --progress --human-readable --delete --exclude=private --chmod=D0755,F0644 dst/ root@static.lxc:/srv/www/

deploy-local: build
	$(call LOG_STATUS,DEPLOY,LOCAL)
	@-rsync -a --progress --human-readable --delete --chmod=D0755,F0644 dst/ /var/www/

deploy-beta: build
	$(call LOG_STATUS,DEPLOY,BETA)
	rclone copy -P ./dst/ $(BLBETALOCATION)

$(FAVICON_HEADER): $(FAVICON_SOURCE)
	$(call LOG_STATUS,FAVICON,$(FAVICON_SIZES))
	@./libexec/mkfavicons $< $(FAVICON_HEADER) $(FAVICON_SIZES) 2>/dev/null

variables: src/installation.html src/index.html src/news.html
	$(call LOG_STATUS,VARIABLES,$(notdir $^))
	$(foreach VAR,$(RELEASE_SUBST),$(shell sed -i 's^@@$(VAR)@@^$($(VAR))^' $^ ))

###############################################################################

%.html: %.mkd $(TEMPLATE) $(FAVICON_HEADER)
	$(call LOG_STATUS,PANDOC,$(notdir $@))
	@pandoc $(ARGV) $(PANDOC_VARS) -o $@ $<
	@./libexec/postproc $@

src/index.html: src/index.mkd $(TEMPLATE) $(wildcard include/index/*.html) $(FAVICON_HEADER) $(GALLERY_HEADER) $(RECENT_NEWS_HEADER)
	$(call LOG_STATUS,PANDOC,$(notdir $@))
	@pandoc $(filter-out --toc,$(ARGV)) $(PANDOC_VARS) \
		-H include/index/header.html \
		-B include/index/leader.html \
		-A include/index/after.html \
		-o $@ $<
	@./libexec/postproc $@

src/installation.html: src/installation.mkd $(TEMPLATE) $(wildcard include/installation/*.html) $(FAVICON_HEADER)
	$(call LOG_STATUS,PANDOC,$(notdir $@))
	@pandoc $(ARGV) $(PANDOC_VARS) \
			-A include/installation/after.html \
			-B include/installation/leader.html \
			-o $@ $<
	@./libexec/postproc $@

src/news.html: src/news.mkd $(TEMPLATE) $(wildcard include/news/*.html) $(FAVICON_HEADER)
	$(call LOG_STATUS,PANDOC,$(notdir $@))
	@pandoc $(ARGV) $(PANDOC_VARS) \
		-A include/news/after.html \
		-o $@ $<
	@./libexec/postproc $@

src/donations.html: src/donations.mkd $(TEMPLATE) $(wildcard include/news/*.html) $(FAVICON_HEADER)
	$(call LOG_STATUS,PANDOC,$(notdir $@))
	@pandoc $(ARGV) $(PANDOC_VARS) \
		-A include/donations/after.html \
		-o $@ $<
	@./libexec/postproc $@

$(DONATION_JSON): $(DONATION_DATA) ./libexec/donation-report $(DESTDIR)
	$(call LOG_STATUS,REPORT,$(notdir $@))
	@./libexec/donation-report $< > $@

$(GALLERY_HEADER): $(SETTINGS)
	$(call LOG_STATUS,GALLERY,$(notdir $@))
	@./libexec/gallery $< > $@

$(GALLERY_INDEX): $(SETTINGS) libexec/gallery-json
	$(call LOG_STATUS,GALLERY,$@)
	@./libexec/gallery-json $(SETTINGS) $(GALLERY_INDEX)

# Generate thumbnails for the frontpage gallery. It is possible that
# with different resize operators, imagemagick produces even more high-quality
# preview images. Documentation: http://www.imagemagick.org/Usage/resize/
$(THUMB_DIR)/%.thumb.jpg: $(THUMB_DIR)/../%.png
	$(call LOG_STATUS,THUMBNAIL,$(notdir $@))
	@convert $< -define jpeg:dct-method=float -strip -interlace Plane -sampling-factor 4:2:0 -resize $(THUMB_DIM) -quality $(THUMB_JPEG_QUALITY) $@
	@convert $< -quality $(THUMB_FULLSIZE_JPEG_QUALITY) $(<:.png=.jpg)

$(DESTDIR):
	@mkdir -p -- $(@)

$(THUMB_DIR):
	@mkdir -p $@

serve: build
	cd $(DESTDIR) && python -m http.server

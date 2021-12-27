import { Main, IXHRReject, IServerErrorResponse } from "../../assets/js/main.js";

class Directory
{
    private firstLoad: boolean;
    private directory: string[];
    private elements:
    {
        directoryListing: HTMLTableSectionElement;
        preview:
        {
            container: HTMLDivElement;
            background: HTMLDivElement;
            iframe: HTMLIFrameElement;
        };
        sharingMenu:
        {
            container: HTMLDivElement,
            background: HTMLDivElement,
            sharingTypes: HTMLSelectElement,
            subMenus:
            {
                publicOptions:
                {
                    container: HTMLTableSectionElement,
                    publicSharingTimeInput: HTMLInputElement
                }
            },
            unsavedChangesNotice: HTMLParagraphElement,
            buttonContainer: HTMLDivElement,
            sharingLink: HTMLButtonElement,
            saveButton: HTMLButtonElement
        }
    };

    constructor()
    {
        new Main();

        this.firstLoad = true;
        this.directory = [];
        this.elements =
        {
            directoryListing: Main.GetElement("#directoryListing"),
            preview:
            {
                container: Main.ThrowIfNullOrUndefined(document.querySelector("#filePreviewContainer")),
                background: Main.ThrowIfNullOrUndefined(document.querySelector("#filePreviewContainer > .background")),
                iframe: Main.ThrowIfNullOrUndefined(document.querySelector("#filePreview"))
            },
            sharingMenu:
            {
                container: Main.ThrowIfNullOrUndefined(document.querySelector("#sharingMenu")),
                background: Main.ThrowIfNullOrUndefined(document.querySelector("#sharingMenu > .background")),
                sharingTypes: Main.ThrowIfNullOrUndefined(document.querySelector("#sharingTypes")),
                subMenus:
                {
                    publicOptions:
                    {
                        container: Main.ThrowIfNullOrUndefined(document.querySelector("#publicSharing")),
                        publicSharingTimeInput: Main.ThrowIfNullOrUndefined(document.querySelector("#publicExpiryTime"))
                    }
                },
                unsavedChangesNotice: Main.ThrowIfNullOrUndefined(document.querySelector("#unsavedSharingChangesNotice")),
                buttonContainer: Main.ThrowIfNullOrUndefined(document.querySelector("#sharingMenu .joinButtons")),
                sharingLink: Main.ThrowIfNullOrUndefined(document.querySelector("#sharingLink")),
                saveButton: Main.ThrowIfNullOrUndefined(document.querySelector("#saveSharing"))
            }
        };

        this.elements.preview.background.addEventListener("click", () =>
        {
            Main.FadeElement("none", this.elements.preview.container);
            this.elements.preview.iframe.src = "";
        });

        this.elements.sharingMenu.background.addEventListener("click", () => { Main.FadeElement("none", this.elements.sharingMenu.container); });
        this.elements.sharingMenu.sharingTypes.addEventListener("change", () => { this.UpdateSharingMenu(); });
        this.elements.sharingMenu.subMenus.publicOptions.publicSharingTimeInput.addEventListener("change", () =>
        {
            this.elements.sharingMenu.unsavedChangesNotice.style.display = "block";
            // this.elements.sharingMenu.saveButton.style.display = "block";
        });

        //Navigation bar highlight override.
        Main.GetElement<HTMLAnchorElement>(`.navigationContainer a[href='${Main.WEB_ROOT}/view/directory/']`).classList.add("accent");

        //Listen for page navigation.
        window.addEventListener("popstate", (e) => { this.OnWindowPopState(window.location.pathname); });
        this.OnWindowPopState(window.location.pathname);
    }

    private OnWindowPopState(path: string): void
    {
        const urlPartsToRemove = Main.WEB_ROOT.split("/").filter(n => n).length + 2; // +2 for .../view/directory/
        const urlParts = path.split("/").filter(n => n).slice(urlPartsToRemove);
        this.LoadDirectory(urlParts.join("/"), true);
    }

    private UpdateSharingMenu(): void
    {
        this.elements.sharingMenu.unsavedChangesNotice.style.display = "block";
        // this.elements.sharingMenu.saveButton.style.display = "block";
        switch (this.elements.sharingMenu.sharingTypes.value)
        {
            case "public":
                this.elements.sharingMenu.subMenus.publicOptions.container.style.display = "table-row";
                this.elements.sharingMenu.subMenus.publicOptions.publicSharingTimeInput.value = "";
                break;
            case "private":
                this.elements.sharingMenu.subMenus.publicOptions.container.style.display = "none";
                break;
        }
    }

    private async ShowSharingMenu(path: string, isDirectory: boolean, updateVisibility: boolean = true): Promise<void>
    {
        if (path.startsWith("/")) { path = path.substring(1); }

        const shareDetailsResponse = await this.GetShareDetails(path, isDirectory);
        if (typeof shareDetailsResponse === "string")
        {
            Main.Alert(Main.GetErrorMessage(shareDetailsResponse));
            return;
        }

        this.elements.sharingMenu.unsavedChangesNotice.style.display = "none";
        // this.elements.sharingMenu.saveButton.style.display = "none";
        this.elements.sharingMenu.sharingTypes.value = shareDetailsResponse.shared ? "public" : "private";
        if (shareDetailsResponse.shared)
        {
            this.elements.sharingMenu.sharingLink.style.display = "block";
            this.elements.sharingMenu.sharingLink.onclick = () =>
            {
                navigator.clipboard.writeText(
                    window.location.origin +
                    Main.WEB_ROOT +
                    `/view/${isDirectory ? "directory" : "file"}/` +
                    shareDetailsResponse.sid!
                );
            };
            this.elements.sharingMenu.buttonContainer.classList.add("joinButtons");
            this.elements.sharingMenu.subMenus.publicOptions.container.style.display = "table-row";
            this.elements.sharingMenu.subMenus.publicOptions.publicSharingTimeInput.value = Main.FormatUnixToFormDate(parseInt(shareDetailsResponse.expiry_time!) * 1000);
        }
        else
        {
            this.elements.sharingMenu.sharingLink.style.display = "none";
            this.elements.sharingMenu.buttonContainer.classList.remove("joinButtons");
            this.elements.sharingMenu.subMenus.publicOptions.container.style.display = "none";
        }

        this.elements.sharingMenu.saveButton.onclick = async () =>
        {
            if (shareDetailsResponse.shared)
            {
                switch (this.elements.sharingMenu.sharingTypes.value)
                {
                    case "public":
                        const updateResponse = await this.SaveShareDetails(
                            "update",
                            isDirectory,
                            {
                                sid: shareDetailsResponse.sid,
                                path: path,
                                share_type: this.elements.sharingMenu.subMenus.publicOptions.publicSharingTimeInput.value !== "" ? 1 : 0,
                                expiry_time: this.elements.sharingMenu.subMenus.publicOptions.publicSharingTimeInput.value !== "" ? new Date(this.elements.sharingMenu.subMenus.publicOptions.publicSharingTimeInput.value).getTime() / 1000 : 0
                            }
                        );
                        if (typeof updateResponse === "string")
                        {
                            Main.Alert(Main.GetErrorMessage(updateResponse));
                            return;
                        }
                        else
                        {
                            this.ShowSharingMenu(path, isDirectory, false);
                        }
                        break;
                    case "private":
                        const deleteResponse = await this.SaveShareDetails(
                            "delete",
                            isDirectory,
                            {
                                sid: shareDetailsResponse.sid
                            }
                        );
                        if (typeof deleteResponse === "string")
                        {
                            Main.Alert(Main.GetErrorMessage(deleteResponse));
                        }
                        else
                        {
                            this.ShowSharingMenu(path, isDirectory, false);
                        }
                        break;
                }
            }
            else
            {
                if (this.elements.sharingMenu.sharingTypes.value === "public")
                {
                    const updateResponse = await this.SaveShareDetails(
                        "add",
                        isDirectory,
                        {
                            path: path,
                            share_type: this.elements.sharingMenu.subMenus.publicOptions.publicSharingTimeInput.value !== "" ? 1 : 0,
                            expiry_time: this.elements.sharingMenu.subMenus.publicOptions.publicSharingTimeInput.value !== "" ? new Date(this.elements.sharingMenu.subMenus.publicOptions.publicSharingTimeInput.value).getTime() / 1000 : 0
                        }
                    );
                    if (typeof updateResponse === "string")
                    {
                        Main.Alert(Main.GetErrorMessage(updateResponse));
                        return;
                    }
                    else
                    {
                        this.ShowSharingMenu(path, isDirectory, false);
                    }
                }
                else //Was already private and still is.
                {
                    this.elements.sharingMenu.unsavedChangesNotice.style.display = "none";
                }
            }
        };

        if (updateVisibility)
        {
            Main.FadeElement("block", this.elements.sharingMenu.container);
        }
    }

    private async LoadDirectory(path: string, fromPopState: boolean): Promise<void>
    {
        const directoryResponse = await this.GetDirectory(path);
        if (typeof directoryResponse === "string")
        {
            Main.Alert(Main.GetErrorMessage(directoryResponse));
            return;
        }

        //Update directory and URL.
        this.directory = directoryResponse.path;
        const titleSplit = document.title.split("|");
        document.title = `${directoryResponse.path[directoryResponse.path.length - 1]??"Directory"} | ${titleSplit[titleSplit.length - 1]}`;
        //Dont push to history if it is the first load or if we are coming from popstate.
        if (!this.firstLoad && !fromPopState)
        {
            window.history.pushState(null, "", Main.WEB_ROOT + "/view/directory/" + this.directory.join("/"));
        }
        this.firstLoad = false;
        
        //Clear the directory listing.
        this.elements.directoryListing.innerHTML = "";

        if (directoryResponse.path.length > 0)
        {
            //Add the parent directory link.
            const row = this.CreateDirectoryItem(false, "..", true);
            row.addEventListener("click", () => { this.LoadDirectory(directoryResponse.path.slice(0, -1).join("/"), false); });
            this.elements.directoryListing.appendChild(row);
        }

        //Add the directories first.
        for (const directory of directoryResponse.directories)
        {
            const row = this.CreateDirectoryItem(!directoryResponse.sharedPath, directory, true);
            this.elements.directoryListing.appendChild(row);
        }

        //Add the files.
        for (const file of directoryResponse.files)
        {
            const row = this.CreateDirectoryItem(!directoryResponse.sharedPath, `${file.name}${file.extension ? `.${file.extension}` : ''}`, false, file);
            this.elements.directoryListing.appendChild(row);
        }
    }

    //Thanks copilot for reading my html structure to generate most of this code :) (nice time save).
    private CreateDirectoryItem(optionsEnabled: boolean, displayName: string, isDirectory: boolean, file?: IFile): HTMLTableRowElement
    {
        const row = document.createElement("tr");
        row.classList.add("listItem");

        //#region Name column
        const nameColumn = document.createElement("td");
        nameColumn.classList.add("nameColumn");
        
        const table = document.createElement("table");
        const tbody = document.createElement("tbody");
        const tr = document.createElement("tr");

        const td1 = document.createElement("td");
        const td2 = document.createElement("td");

        const img = document.createElement("img");
        img.src = isDirectory ? `${Main.WEB_ROOT}/assets/images/folder.png` : `${Main.WEB_ROOT}/assets/images/file.png`;
        img.alt = isDirectory ? "Folder" : "File";
        img.classList.add("icon");

        const p = document.createElement("p");
        p.innerText = displayName;

        td1.appendChild(img);
        td2.appendChild(p);

        tr.appendChild(td1);
        tr.appendChild(td2);
        tbody.appendChild(tr);
        table.appendChild(tbody);
        nameColumn.appendChild(table);

        row.appendChild(nameColumn);
        //#endregion

        //#region Type column
        const typeColumn = document.createElement("td");
        typeColumn.classList.add("typeColumn");

        const p2 = document.createElement("p");
        p2.innerText = isDirectory ? "Folder" : file!.extension || "File";

        typeColumn.appendChild(p2);

        row.appendChild(typeColumn);
        //#endregion

        //#region Date column
        const dateColumn = document.createElement("td");
        dateColumn.classList.add("dateColumn");

        const p3 = document.createElement("p");
        p3.innerText = isDirectory ? '' : Main.FormatUnix(file!.lastModified * 1000);

        dateColumn.appendChild(p3);

        row.appendChild(dateColumn);
        //#endregion

        //#region Size column
        const sizeColumn = document.createElement("td");
        sizeColumn.classList.add("sizeColumn");

        const p4 = document.createElement("p");
        p4.innerText = isDirectory ? "" : Main.FormatBytes(file!.size);

        sizeColumn.appendChild(p4);
        
        row.appendChild(sizeColumn);
        //#endregion

        //#region Options column
        
        const optionsColumn = document.createElement("td");
        optionsColumn.classList.add("optionsColumn");

        var button: HTMLButtonElement;
        if (optionsEnabled)
        {
            button = document.createElement("button");
            button.innerText = "Sharing";
            button.onclick = () =>
            {
                this.ShowSharingMenu(
                    this.directory.join('/') + '/' + displayName,
                    isDirectory
                );
            };

            optionsColumn.appendChild(button);
        }
        
        row.appendChild(optionsColumn);
        //#endregion

        row.onclick = (e) =>
        {
            //Make sure the user is not clicking on the share button.
            if (e.target !== button)
            {
                if (isDirectory)
                {
                    this.LoadDirectory(this.directory.concat(displayName).join("/"), false);
                }
                else if (e.ctrlKey)
                {
                    window.open(Main.WEB_ROOT + "/view/file/" + this.directory.concat(displayName).join("/"));
                }
                else
                {
                    this.elements.preview.iframe.src = Main.WEB_ROOT + "/view/file/" + this.directory.concat(displayName).join("/");
                    Main.FadeElement("block", this.elements.preview.container);
                }
            }
        }

        return row;
    }

    private async GetDirectory(path: string): Promise<string | IDirectoryResponse>
    {
        const directoryResponse = await Main.XHR<IDirectoryResponse>(
        {
            url: `${Main.WEB_ROOT}/api/v1/directory/${path}`,
            method: "GET",
            data:
            {
                uid: Main.RetreiveCache("uid"),
                token: Main.RetreiveCache("token")
            }
        })
        .catch((error: IXHRReject<IServerErrorResponse>) =>
        {
            return error;
        });

        return (directoryResponse.response as IServerErrorResponse).error !== undefined ?
            (directoryResponse.response as IServerErrorResponse).error :
            (directoryResponse.response as IDirectoryResponse);
    }

    private async GetShareDetails(path: string, isDirectory: boolean): Promise<string | IShareStatus>
    {
        const directoryResponse = await Main.XHR<IShareStatus>(
        {
            url: `${Main.WEB_ROOT}/api/v1/${isDirectory ? "directory" : "file"}/`,
            method: "POST",
            data:
            {
                method: "get_share",
                id: Main.RetreiveCache("uid"),
                token: Main.RetreiveCache("token"),
                path: path
            },
            headers:
            {
                "Content-Type": "application/x-www-form-urlencoded"
            }
        })
        .catch((error: IXHRReject<IServerErrorResponse>) =>
        {
            return error;
        });

        return (directoryResponse.response as IServerErrorResponse).error !== undefined ?
            (directoryResponse.response as IServerErrorResponse).error :
            (directoryResponse.response as IShareStatus);
    }

    private async SaveShareDetails(
        method: "add" | "update" | "delete",
        isDirectory: boolean,
        data:
        {
            path?: string,
            sid?: string,
            share_type?: 0 | 1,
            expiry_time?: number
        } = {}
    ): Promise<string | IShareResponse>
    {
        const directoryResponse = await Main.XHR<IShareResponse>(
        {
            url: `${Main.WEB_ROOT}/api/v1/${isDirectory ? "directory" : "file"}/`,
            method: "POST",
            data:
            {
                method: `${method}_share`,
                id: Main.RetreiveCache("uid"),
                token: Main.RetreiveCache("token"),
                ...data
            },
            headers:
            {
                "Content-Type": "application/x-www-form-urlencoded"
            }
        })
        .catch((error: IXHRReject<IServerErrorResponse>) =>
        {
            return error;
        });

        return (directoryResponse.response as IServerErrorResponse).error !== undefined ?
            (directoryResponse.response as IServerErrorResponse).error :
            (directoryResponse.response as IShareResponse);
    }
}
new Directory();

interface IDirectoryResponse
{
    sharedPath: boolean;
    path: string[];
    directories: string[];
    files: IFile[];
}

interface IShareStatus
{
    shared: boolean;
    sid?: string;
    share_type?: string;
    expiry_time?: string;
}

interface IShareResponse
{
    sid?: string;
}

export interface IFile
{
    name: string;
    extension?: string;
    size: number;
    lastModified: number;
    mimeType: string;
    width?: number;
    height?: number;
}
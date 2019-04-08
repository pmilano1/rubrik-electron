import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {Component, OnInit} from '@angular/core';
import {RubrikService} from './rubrik.service';
import {HttpClientModule} from '@angular/common/http';
import {ClarityModule} from '@clr/angular';
import {AppVariables} from './app.constants';

@Component({
    selector: 'App',
    template: `
        <div>
            <img src="assets/rbk-h.png" height="100">
        </div>
        <div>
            <ng-container *ngIf="this.objectData">
                <clr-datagrid class="datagrid-compact" [(clrDgSelected)]="selectedObjects">
                    <ng-container *ngFor="let column of this.objectData['columns']">
                        <clr-dg-column [clrDgField]=column>
                            <ng-container *clrDgHideableColumn="{hidden: false}">
                                {{column}}
                            </ng-container>
                        </clr-dg-column>
                    </ng-container>
                    // This isn't working
                    <clr-dg-row *clrDgItems="let object of this.objectData['dataGrid']" [clrDgItem]="object">
                        <ng-container *ngFor="let item of object">
                            <clr-dg-cell>
                                {{item}}
                            </clr-dg-cell>
                        </ng-container>
                    </clr-dg-row>
                    <clr-dg-footer>
                        <clr-dg-pagination #pagination [clrDgPageSize]="5">
                            <clr-dg-page-size [clrPageSizeOptions]="[10,20,50,100]">Objects per page</clr-dg-page-size>
                            {{pagination.firstItem + 1}} - {{pagination.lastItem + 1}}
                            of {{pagination.totalItems}} Objects
                        </clr-dg-pagination>
                    </clr-dg-footer>
                </clr-datagrid>
            </ng-container>
        </div>
    `
})


export class AppComponent implements OnInit {
    public readonly name = 'electron-forge';
    public rubrikDNS = 'shrd1-rbk01-rp.rubrikdemo.com';
    public rubrikAPIToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIyOWNiNzFhMS0yZGIwLTRlZGQtYjA1Mi1kNmQ1NWRlMjBiOTRfMmY2MzFmYjItNzUyMi00Z' +
        'TcwLWFjNzgtMzk1Y2EzNTIwMmRjIiwiaXNzIjoiMjljYjcxYTEtMmRiMC00ZWRkLWIwNTItZDZkNTVkZTIwYjk0IiwianRpIjoiMGIwYzI3M2MtZjcwOS00YjVjLWJiNTctZTk0YWF' +
        'jZWMzZDE5In0.yGyQYvzQmGIue_GlD7K8TkCDm46I2bLGalE8XJec3nI';
    public objectData = [];
    public selectedObjects: any = [];

    constructor(private RubrikService: RubrikService) {
    }

    public ngOnInit(): void {
        this.getObjectData();
    }

    public getObjectData() {
        this.RubrikService.rubrikGetRequest(
            `https://${this.rubrikDNS}/${AppVariables.internalBaseURL}report?name=` + 'Object Protection Summary', this.rubrikAPIToken).subscribe(
            r => {
                for (let i = 0; i < r['total']; i++) {
                    if (r['data'][i]['name'] === 'Object Protection Summary') {
                        let fileRecPayload = {'limit': 9999};
                        let postUrl = `https://${this.rubrikDNS}/${AppVariables.internalBaseURL}report/${r['data'][i]['id']}/table`;
                        this.RubrikService.rubrikPostRequest(postUrl, fileRecPayload, this.rubrikAPIToken).subscribe(resp => {
                                this.objectData = resp;
                            }
                        );
                    }
                }
            }
        );
    }
}

@NgModule({
    imports: [
        BrowserModule,
        ClarityModule,
        HttpClientModule
    ],
    declarations: [AppComponent],
    bootstrap: [AppComponent],
    providers: [
        RubrikService
    ]

})
export class AppModule {
}
